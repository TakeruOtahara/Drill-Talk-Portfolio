# --- v3-app/backend/main.py ---
import json
import base64
import random
import logging
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from logic import GeminiProvider
from prompts import STATIC_BACKCHANNELS
from config import settings  # 💡 設定プロキシをインポート

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

# ==========================================
# 💡 1. セキュリティ：CORS / オリジン制限
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_brain = GeminiProvider()

# ==========================================
# 💡 WebSocket エンドポイント
# ==========================================
@app.websocket("/ws/manabu")
async def websocket_endpoint(
    websocket: WebSocket, 
    api_key: str = Query(None)
):
    # 🛡️ 第1関門：オリジン制限（CSWSH対策）
    client_origin = websocket.headers.get("origin")
    if not settings.ALLOWED_ORIGINS or client_origin not in settings.ALLOWED_ORIGINS:
        logger.warning(f"🚫 拒否：不正なオリジン: {client_origin}")
        await websocket.accept() 
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 🛡️ 第2関門：API Key（合言葉）の厳格チェック
    if not settings.DRILLTALK_API_KEY or api_key != settings.DRILLTALK_API_KEY:
        logger.warning(f"🚫 拒否：API Key不一致または未設定: {api_key}")
        if not websocket.client_state.CONNECTED:
            await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # 🔓 門番をすべてパスして初めて入室許可
    await websocket.accept()
    logger.info(f"📢 認証成功: {client_origin} から接続されました。")

    state = {
        "original_text": "",
        "structured_original": {},
        "lecture_history": [],
        "chars_since_last_question": 0
    }

    try:
        while True:
            data = await websocket.receive_text()

            # 🛡️ JSON解析の例外保護
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.error("❌ 不正なJSON形式を受信しました。")
                continue

            data_type = message.get("type")

            if data_type == "PING":
                continue

            # 🔄 ① 記憶の同期（SYNC_SESSION）
            if data_type == "SYNC_SESSION":
                payload = message.get("payload", {})
                state["lecture_history"] = payload.get("lecture_history", [])
                state["structured_original"] = payload.get("structured_original", {})
                state["original_text"] = payload.get("original_text", "")
                state["chars_since_last_question"] = payload.get("chars_count", 0)
                
                logger.info(f"🧠 記憶同期成功：履歴[{len(state['lecture_history'])}件] を復旧。")
                await websocket.send_json({"type": "SESSION_SYNCED"})
                continue

            # 📸 ② 教材解析（INIT_MATERIAL）
            if data_type == "INIT_MATERIAL":
                images_base64 = message.get("images_base64", [])
                if not isinstance(images_base64, list) or len(images_base64) > 5:
                    await websocket.send_json({"type": "ERROR", "message": "画像は最大5枚までです。"})
                    continue
                
                try:
                    logger.info(f"📸 教材解析開始（枚数: {len(images_base64)}）")
                    image_bytes_list = []
                    for img in images_base64:
                        if "," in img: img = img.split(",")[1]
                        image_bytes_list.append(base64.b64decode(img))
                    
                    original, structured = await ai_brain.process_initial_material(image_bytes_list)
                    
                    if original is None or structured is None:
                        raise ValueError("AI解析結果が空です")

                    state["original_text"] = original
                    state["structured_original"] = structured
                    
                    await websocket.send_json({
                        "type": "MATERIAL_READY", 
                        "structured_original": structured,
                        "original_text": original
                    })
                    logger.info("✅ 教材解析成功")
                except Exception as e:
                    logger.error(f"❌ INIT_MATERIAL 解析エラー: {e}", exc_info=True)
                    await websocket.send_json({"type": "ERROR", "message": "教材の解析に失敗しました。"})

            # 💬 ③ リアルタイム対話（USER_TALK）
            elif data_type == "USER_TALK":
                user_text = message.get("text", "")
                skip_reaction = message.get("skip_reaction", False) 
                
                if user_text:
                    state["lecture_history"].append(user_text)
                    state["chars_since_last_question"] += len(user_text)
                    
                    if not skip_reaction:
                        if state["chars_since_last_question"] >= 50 and random.random() < 0.3:
                            question = await ai_brain.generate_student_question(
                                " ".join(state["lecture_history"]), 
                                state["structured_original"]
                            )
                            state["chars_since_last_question"] = 0
                            await websocket.send_json({
                                "type": "STUDENT_QUESTION", 
                                "message": question,
                                "emotion": "confused"
                            })
                        elif random.random() < 0.5:
                            reaction = random.choice(STATIC_BACKCHANNELS)
                            await websocket.send_json({
                                "type": "REACTION",
                                "emotion": reaction["emotion"],
                                "message": reaction["text"]
                            })

            # 📓 ④ 最終評価（FINISH_LECTURE）
            elif data_type == "FINISH_LECTURE":
                user_memo = message.get("user_memo", "")
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
                    logger.error(f"❌ FINISH_LECTURE 生成失敗: {e}", exc_info=True)
                    await websocket.send_json({"type": "ERROR", "message": "評価ノートの作成に失敗しました。"})

            # 🔄 ⑤ セッションリセット
            elif data_type == "RESTART_LECTURE":
                state["lecture_history"] = []
                state["chars_since_last_question"] = 0
                await websocket.send_json({"type": "RESTARTED", "message": "準備完了！"})

    except WebSocketDisconnect:
        logger.info("🔌 接続終了")
    except Exception as e:
        logger.error(f"⚠️ 致命的エラー: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "ERROR", "message": "サーバーエラーが発生しました。"})
        except:
            pass