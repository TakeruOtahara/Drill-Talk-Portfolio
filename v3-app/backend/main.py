# --- v3-app/backend/main.py ---
import json
import base64
import random
import logging
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from logic import GeminiProvider

# ==========================================
# 💡 構造化ロギングの設定
# ==========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("drilltalk")

app = FastAPI()
ai_brain = GeminiProvider()

@app.websocket("/ws/manabu")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("📢 接続成功：フロントエンドからマナブ君に回線がつながりました！")

    # セッションごとの状態管理（ステート）
    state = {
        "original_text": "",
        "structured_original": {},
        "lecture_history": [],
        "chars_since_last_question": 0
    }

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            data_type = message.get("type")

            # 💡 【Azure/Keep-alive】
            if data_type == "PING":
                continue

            # 💡 【① 記憶の同期】localStorage からの復旧
            if data_type == "SYNC_SESSION":
                payload = message.get("payload", {})
                state["lecture_history"] = payload.get("lecture_history", [])
                state["structured_original"] = payload.get("structured_original", {})
                state["original_text"] = payload.get("original_text", "")
                
                logger.info(f"🧠 記憶同期：履歴 {len(state['lecture_history'])} 件を復旧しました。")
                await websocket.send_json({"type": "SESSION_SYNCED"})
                continue

            # 💡 【② 教材解析】
            if data_type == "INIT_MATERIAL":
                images_base64 = message.get("images_base64", [])
                if not isinstance(images_base64, list) or len(images_base64) > 5:
                    logger.warning("⚠️ 画像枚数制限（5枚）を超過したリクエストを受信しました。")
                    await websocket.send_json({"type": "ERROR", "message": "画像は最大5枚までです。"})
                    continue
                
                try:
                    image_bytes_list = []
                    for img in images_base64:
                        if "," in img: img = img.split(",")[1]
                        image_bytes_list.append(base64.b64decode(img))
                    
                    logger.info(f"📸 {len(image_bytes_list)} 枚の画像を解析中...")
                    original, structured = await ai_brain.process_initial_material(image_bytes_list)
                    
                    # 💡 【堅牢性】パース失敗時のハンドリング
                    if not original or not structured:
                        logger.warning("⚠️ Geminiの出力解析に失敗しました（JSON不正）。")
                        await websocket.send_json({
                            "type": "ERROR", 
                            "message": "教材がうまく読み取れなかったみたい...もう一度、写真を撮り直してくれる？"
                        })
                        continue

                    state["original_text"] = original
                    state["structured_original"] = structured
                    
                    await websocket.send_json({
                        "type": "MATERIAL_READY", 
                        "structured_original": structured,
                        "original_text": original
                    })
                    logger.info("✅ 教材解析成功：準備完了")

                except Exception as e:
                    logger.error(f"❌ INIT_MATERIAL で例外発生: {e}", exc_info=True)
                    await websocket.send_json({"type": "ERROR", "message": "教材の解析中にエラーが発生しました。"})

            # 💡 【③ リアルタイム対話ロジック】
            elif data_type == "USER_TALK":
                user_text = message.get("text", "")
                skip_reaction = message.get("skip_reaction", False) 
                
                if user_text:
                    state["lecture_history"].append(user_text)
                    state["chars_since_last_question"] += len(user_text)
                    
                    if not skip_reaction:
                        # 30%の確率でマナブ君が質問する
                        if state["chars_since_last_question"] >= 50 and random.random() < 0.3:
                            logger.info(f"🤔 質問生成開始（累積文字数: {state['chars_since_last_question']}）")
                            question = await ai_brain.generate_student_question(
                                " ".join(state["lecture_history"]), 
                                state["structured_original"]
                            )
                            state["chars_since_last_question"] = 0
                            await websocket.send_json({"type": "STUDENT_QUESTION", "message": question})
                        else:
                            # 確率で相槌を打つ
                            aizuchi_text = ""
                            if random.random() < 0.5:
                                aizuchi_text = random.choice(["はい！", "なるほど", "うんうん", "そうなんですね", "おもしろいです！"])
                            
                            await websocket.send_json({
                                "type": "REACTION",
                                "emotion": random.choice(["happy", "neutral", "excited"]),
                                "message": aizuchi_text
                            })

            # 💡 【④ 最終評価】
            elif data_type == "FINISH_LECTURE":
                user_memo = message.get("user_memo", "")
                logger.info(f"📥 最終評価リクエストを受信（履歴: {len(state['lecture_history'])} 件）")
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
                    logger.info("📝 最終評価ノートの生成に成功しました。")
                except Exception as e:
                    logger.error(f"❌ FINISH_LECTURE で例外発生: {e}", exc_info=True)
                    await websocket.send_json({"type": "ERROR", "message": "評価ノートの作成に失敗しました。"})

            # 💡 【⑤ セッションリセット】
            elif data_type == "RESTART_LECTURE":
                state["lecture_history"] = []
                state["chars_since_last_question"] = 0
                logger.info("🔄 セッションをリセットしました。")
                await websocket.send_json({"type": "RESTARTED", "message": "準備ができました！もう一度説明してください！"})

    except WebSocketDisconnect:
        logger.info("🔌 接続終了：先生が退出しました。")
    except Exception as e:
        logger.error(f"⚠️ 予期せぬ致命的なエラーが発生しました: {e}", exc_info=True)