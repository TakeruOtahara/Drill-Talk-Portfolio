# --- v3-app/backend/main.py ---
import json
import base64
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from logic import GeminiProvider

app = FastAPI()
ai_brain = GeminiProvider()

@app.websocket("/ws/manabu")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("📢 接続成功：フロントエンドからマナブ君に回線がつながりました！", flush=True)

    # セッションごとの状態管理
    state = {
        "original_text": "",
        "structured_original": {},
        "lecture_history": [],
        "chars_since_last_question": 0  # 💡【新規追加】質問の間隔を調整するカウンター
    }

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            data_type = message.get("type")

            # 【Azure対応】Pingを受信したら無視してTCP接続を維持する
            if data_type == "PING":
                continue

            if data_type == "INIT_MATERIAL":
                # 教材（画像）の受信と解析
                images_base64 = message.get("images_base64", [])
                
                # 【セキュリティ強化】バックエンド側での枚数制限
                if not isinstance(images_base64, list) or len(images_base64) > 5:
                    await websocket.send_json({"type": "ERROR", "message": "画像は最大5枚までです。"})
                    continue
                
                try:
                    image_bytes_list = []
                    for img in images_base64:
                        # 【セキュリティ強化】データサイズの簡易チェック（約15MBの上限）
                        if len(img) > 15 * 1024 * 1024:
                            raise ValueError("画像サイズが大きすぎます。")
                        image_bytes_list.append(base64.b64decode(img))
                    
                    original, structured = await ai_brain.process_initial_material(image_bytes_list)
                    state["original_text"] = original
                    state["structured_original"] = structured
                    await websocket.send_json({"type": "MATERIAL_READY"})
                except Exception as e:
                    print(f"Error in INIT_MATERIAL: {e}", flush=True)
                    await websocket.send_json({"type": "ERROR", "message": "教材の解析に失敗しました。もう一度試してください。"})

            elif data_type == "USER_TALK":
                user_text = message.get("text", "")
                skip_reaction = message.get("skip_reaction", False) 
                
                if user_text:
                    # ログの蓄積と文字数カウンターの加算
                    state["lecture_history"].append(user_text)
                    state["chars_since_last_question"] += len(user_text)
                    
                    if not skip_reaction:
                        # 💡【UX改善】前回質問してから（または開始から）50文字以上話しているかチェック
                        if state["chars_since_last_question"] >= 50 and random.random() < 0.3:
                            question = await ai_brain.generate_student_question(
                                " ".join(state["lecture_history"]), 
                                state["structured_original"]
                            )
                            # 質問が生成されたらカウンターをリセット
                            state["chars_since_last_question"] = 0

                            await websocket.send_json({
                                "type": "STUDENT_QUESTION",
                                "message": question
                            })
                        else:
                            # 💡 文字数が足りない、または30%の抽選に漏れた場合は相槌を打つ
                            emotions = ["happy", "neutral", "excited"]
                            aizuchi_text = ""
                            
                            if random.random() < 0.5:
                                aizuchi_text = random.choice(["はい！", "なるほど", "うんうん", "そうなんですね", "おもしろいです！"])
                            
                            await websocket.send_json({
                                "type": "REACTION",
                                "emotion": random.choice(emotions),
                                "message": aizuchi_text
                            })
                    else:
                        print("⏳ 質問待機中または発声中のため、相槌・質問生成をスキップしました", flush=True)

            elif data_type == "FINISH_LECTURE":
                # メモを受け取り、最終評価へ
                user_memo = message.get("user_memo", "")
                print(f"📥 評価フェーズ：メモ「{user_memo[:20]}...」を受信", flush=True)
                
                try:
                    result = await ai_brain.generate_final_note(
                        state["lecture_history"],
                        state["original_text"],
                        state["structured_original"],
                        user_memo
                    )
                    await websocket.send_json({
                        "type": "FINAL_NOTE",
                        "notebook": result["notebook_html"],
                        "missing_points": result["missing_points"],
                        "misconceptions": result["misconceptions"]
                    })
                except Exception as e:
                    print(f"Error in FINISH_LECTURE: {e}", flush=True)
                    await websocket.send_json({"type": "ERROR", "message": "評価ノートの作成に失敗しました。"})

            elif data_type == "RESTART_LECTURE":
                # 状態をリセットして再開（カウンターもリセット）
                state["lecture_history"] = []
                state["chars_since_last_question"] = 0
                await websocket.send_json({"type": "RESTARTED", "message": "準備ができました。もう一度説明してください！"})

    except WebSocketDisconnect:
        print("🔌 接続終了：先生が退出しました", flush=True)
    except Exception as e:
        print(f"⚠️ 予期せぬエラー: {e}", flush=True)