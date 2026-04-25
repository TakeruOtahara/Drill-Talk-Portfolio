# --- v3-app/backend/main.py ---
import json
import base64
import random
import logging
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from logic import GeminiProvider
from prompts import STATIC_BACKCHANNELS  # 💡 安全な相槌セットをインポート

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

            # 💡 【① 記憶の同期】
            if data_type == "SYNC_SESSION":
                payload = message.get("payload", {})
                state["lecture_history"] = payload.get("lecture_history", [])
                state["structured_original"] = payload.get("structured_original", {})
                state["original_text"] = payload.get("original_text", "")
                state["chars_since_last_question"] = payload.get("chars_count", 0)
                
                # 💡 ログを詳細化：原本が復旧したか一目で分かるように
                has_material = "あり" if state["original_text"] else "なし"
                logger.info(f"🧠 記憶同期成功：教材データ[{has_material}] / 会話履歴[{len(state['lecture_history'])}件] を復旧。")
                
                await websocket.send_json({"type": "SESSION_SYNCED"})
                continue

            # 💡 【② 教材解析】
            if data_type == "INIT_MATERIAL":
                images_base64 = message.get("images_base64", [])
                if not isinstance(images_base64, list) or len(images_base64) > 5:
                    logger.warning("⚠️ 画像枚数制限超過")
                    await websocket.send_json({"type": "ERROR", "message": "画像は最大5枚までです。"})
                    continue
                
                try:
                    logger.info("📸 教材の解析を開始します...")
                    image_bytes_list = []
                    for img in images_base64:
                        if "," in img: img = img.split(",")[1]
                        image_bytes_list.append(base64.b64decode(img))
                    
                    # logic.py のガードレールを通す
                    original, structured = await ai_brain.process_initial_material(image_bytes_list)
                    
                    # 💡 解析失敗時のハンドリング
                    if original is None or structured is None:
                        logger.error("⚠️ Geminiの出力解析に失敗しました。")
                        await websocket.send_json({
                            "type": "ERROR", 
                            "message": "解析に失敗しました。もう一度『開始』をタップしてみてください！"
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
                    await websocket.send_json({"type": "ERROR", "message": "通信が一時的に不安定になりました。"})

            # 💡 【③ リアルタイム対話ロジック】
            elif data_type == "USER_TALK":
                user_text = message.get("text", "")
                skip_reaction = message.get("skip_reaction", False) 
                
                if user_text:
                    state["lecture_history"].append(user_text)
                    state["chars_since_last_question"] += len(user_text)
                    
                    if not skip_reaction:
                        # 30%の確率で質問生成
                        if state["chars_since_last_question"] >= 50 and random.random() < 0.3:
                            logger.info(f"🤔 質問生成開始")
                            question = await ai_brain.generate_student_question(
                                " ".join(state["lecture_history"]), 
                                state["structured_original"]
                            )
                            state["chars_since_last_question"] = 0
                            
                            # 💡 質問時は「confused（教えて？）」の表情を固定して送る
                            await websocket.send_json({
                                "type": "STUDENT_QUESTION", 
                                "message": question,
                                "emotion": "confused"
                            })
                        
                        # 50%の確率で相槌
                        elif random.random() < 0.5:
                            # 💡 prompts.py で定義した表情セットからランダム選択（情緒を安定させる）
                            reaction = random.choice(STATIC_BACKCHANNELS)
                            
                            await websocket.send_json({
                                "type": "REACTION",
                                "emotion": reaction["emotion"],
                                "message": reaction["text"]
                            })

            # 💡 【④ 最終評価】
            elif data_type == "FINISH_LECTURE":
                user_memo = message.get("user_memo", "")
                logger.info(f"📥 最終評価リクエストを受信")
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
                    logger.error(f"❌ FINISH_LECTURE 例外: {e}", exc_info=True)
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