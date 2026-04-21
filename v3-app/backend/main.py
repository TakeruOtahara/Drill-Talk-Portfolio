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
        "chars_since_last_question": 0  # 質問の間隔を調整するカウンター
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
                    print("⚠️ バリデーション失敗：枚数オーバー", flush=True)
                    await websocket.send_json({"type": "ERROR", "message": "画像は最大5枚までです。"})
                    continue
                
                try:
                    image_bytes_list = []
                    for i, img in enumerate(images_base64):
                        # 💡 1. Base64のヘッダー（data:image/...;base64,）を取り除く
                        if "," in img:
                            img = img.split(",")[1]
                        
                        # 💡 2. サイズ制限のバリデーション
                        # Base64は元のバイナリより約1.33倍膨らむため、5MBの画像は約6.7M文字になる
                        max_char_count = 5 * 1024 * 1024 * 1.33 
                        if len(img) > max_char_count:
                            print(f"⚠️ 画像 {i+1} 枚目が大きすぎます（約5MB制限）", flush=True)
                            await websocket.send_json({"type": "ERROR", "message": f"{i+1}枚目の画像が大きすぎます（5MB以下にしてください）"})
                            raise ValueError(f"Image {i+1} size exceeded.")

                        # デコードしてバイト列に変換
                        image_bytes_list.append(base64.b64decode(img))
                    
                    print(f"📸 {len(image_bytes_list)} 枚の画像を解析開始...", flush=True)
                    
                    # Geminiによる教材解析
                    original, structured = await ai_brain.process_initial_material(image_bytes_list)
                    
                    state["original_text"] = original
                    state["structured_original"] = structured
                    
                    await websocket.send_json({"type": "MATERIAL_READY"})
                    print("✅ 解析完了：マナブ君の準備が整いました", flush=True)

                except Exception as e:
                    print(f"❌ Error in INIT_MATERIAL: {e}", flush=True)
                    # 既にエラーメッセージを送っていない場合のみ送る
                    if "exceeded" not in str(e):
                        await websocket.send_json({"type": "ERROR", "message": "教材の解析に失敗しました。画像の形式やサイズを確認してください。"})

            elif data_type == "USER_TALK":
                user_text = message.get("text", "")
                skip_reaction = message.get("skip_reaction", False) 
                
                if user_text:
                    # ログの蓄積と文字数カウンターの加算
                    state["lecture_history"].append(user_text)
                    state["chars_since_last_question"] += len(user_text)
                    
                    if not skip_reaction:
                        # 💡【UX改善】50文字以上話しているかチェック ＋ 30%の確率で質問
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
                            # 文字数が足りない、または確率で相槌を打つ
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
                    print(f"❌ Error in FINISH_LECTURE: {e}", flush=True)
                    await websocket.send_json({"type": "ERROR", "message": "評価ノートの作成に失敗しました。"})

            elif data_type == "RESTART_LECTURE":
                # 状態をリセットして再開
                state["lecture_history"] = []
                state["chars_since_last_question"] = 0
                await websocket.send_json({"type": "RESTARTED", "message": "準備ができました。もう一度説明してください！"})

    except WebSocketDisconnect:
        print("🔌 接続終了：先生が退出しました", flush=True)
    except Exception as e:
        print(f"⚠️ 予期せぬエラー: {e}", flush=True)