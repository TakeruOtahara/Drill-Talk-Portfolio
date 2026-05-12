# --- v3-app/backend/main.py ---
import json
import base64
import random
import logging
import sys
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from logic import GeminiProvider
from prompts import STATIC_BACKCHANNELS
from config import settings

# 追加: スパム判定の閾値（0.5秒）
SPAM_COOLDOWN_SECONDS = 0.5

# ==========================================
# ログを WARNING 以上に絞り込む
# ==========================================
# uvicorn自体の起動・エラーログも WARNING 以上にする
logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
# アクセスログ（200 OKとか）を黙らせる
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# アプリ全体の基本レベルを WARNING に設定（INFO は出力されなくなる）
logging.basicConfig(
    level=logging.WARNING, # INFO から WARNING に変更
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("drilltalk")

# 明示的にこのロガーもレベルを固定
logger.setLevel(logging.WARNING)

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
async def websocket_endpoint(websocket: WebSocket):
    client_origin = websocket.headers.get("origin")
    # APIM（城壁）とNext.js（BFF）を越えてきたリクエストは完全に信頼する
    await websocket.accept()
    logger.info(f"📢 接続確立 (認証はAPIMで通過済み): {client_origin} から接続されました。")

    state = {
        "original_text": "",
        "structured_original": {},
        "lecture_history": [],
        "chars_since_last_question": 0
    }

    last_message_time = 0.0  # 追加: 前回メッセージを処理した時間

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

            # ==========================================
            # 🛡️ 追加: 沈黙のスパム防御層（Silent Drop）
            # ==========================================
            # PING以外の「実質的なリクエスト」に対してのみ連射制限をかける
            current_time = time.time()
            time_since_last = current_time - last_message_time
            
            if time_since_last < SPAM_COOLDOWN_SECONDS:
                logger.warning(f"🚫 スパム防御: [{data_type}] を破棄しました。(Delta: {time_since_last:.3f}s)")
                continue 
            
            # 検証を通過した場合のみタイマーを更新
            last_message_time = current_time
            # ==========================================

            # 🔄 ① 記憶の同期（SYNC_SESSION）
            if data_type == "SYNC_SESSION":
                payload = message.get("payload", {})
                
                # 🛡️ 受信したデータが「空」でない場合のみ上書きを許可する
                frontend_history = payload.get("lecture_history", [])
                if frontend_history:
                    state["lecture_history"] = frontend_history
                    state["chars_since_last_question"] = payload.get("chars_count", 0)

                frontend_structured = payload.get("structured_original", {})
                if frontend_structured:
                    state["structured_original"] = frontend_structured

                frontend_original = payload.get("original_text", "")
                if frontend_original:
                    state["original_text"] = frontend_original
                
                logger.info(f"🧠 記憶同期完了：履歴[{len(state['lecture_history'])}件]")
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