import os
import base64
import json
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from logic import GeminiProvider
from prompts import STATIC_BACKCHANNELS

load_dotenv()

app = FastAPI()
ai_brain = GeminiProvider()

@app.websocket("/ws/manabu")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # --- マナブ君の記憶（ステート管理） ---
    # 授業を跨いでも保持するもの
    state = {
        "original_text": "",
        "themes": [],
        "current_notebook": "", # 1つ前の授業で作ったノート（2回目以降のコンテキスト）
        "lecture_history": [],  # 今回の授業での発言ログ
        "current_score": 0,     # 今回の授業の理解度
        "lesson_count": 1       # 何回目の授業か
    }

    try:
        while True:
            # フロントエンドからメッセージを受信
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            data_type = data.get("type")

            # 1. 教材の初期化（初回のみ）
            if data_type == "INIT_MATERIAL":
                image_bytes = base64.b64decode(data["image_base64"])
                original, themes = await ai_brain.process_initial_material(image_bytes)
                
                state["original_text"] = original
                state["themes"] = themes
                
                await websocket.send_json({
                    "type": "MATERIAL_READY",
                    "themes": themes
                })

            # 2. リアルタイム会話（音声認識結果が届くたびに実行）
            elif data_type == "USER_TALK":
                user_text = data.get("text", "")
                state["lecture_history"].append(user_text)
                
                # スコア更新（API通信なしの高速処理）
                state["current_score"] = ai_brain.calculate_score(user_text, state["current_score"])

                # --- 修正：相槌ロジック ---
                # 1. 「質問ある？」系は最優先（100%反応）
                if any(kw in user_text for kw in ["質問ある", "しつもんある", "わからないところある"]):
                    question = await ai_brain.generate_student_question(
                        state["current_notebook"],
                        state["original_text"],
                        state["themes"]
                    )
                    await websocket.send_json({
                        "type": "STUDENT_QUESTION",
                        "message": question,
                        "emotion": "confused"
                    })
                
                # 2. 通常の相槌は「3回に1回」程度に減らす（確率は好みで調整）
                elif random.random() < 0.3: 
                    reaction = random.choice(STATIC_BACKCHANNELS)
                    await websocket.send_json({
                        "type": "REACTION",
                        "message": reaction["text"],
                        "emotion": reaction["emotion"],
                        "score": state["current_score"]
                    })
                
                # 3. それ以外（70%の確率）は何もしない
                else:
                    pass

            # 3. 本領発揮（5分経過 or 強制終了）
            elif data_type == "FINISH_LECTURE":
                # 前回のノートをコンテキストとして渡し、今回の説明で「上書き」する
                result = await ai_brain.generate_final_note(
                    state["lecture_history"],
                    state["original_text"],
                    state["themes"],
                    previous_notebook=state["current_notebook"]
                )
                
                # 状態を更新（ノートを最新版にし、達成したテーマを [OK] に）
                state["current_notebook"] = result["notebook"]
                state["themes"] = result["themes"]
                
                await websocket.send_json({
                    "type": "FINAL_NOTE",
                    "notebook": result["notebook"],
                    "themes": result["themes"],
                    "score": state["current_score"]
                })

            # 4. 「もう一度教える」ボタン（リセット処理）
            elif data_type == "RESTART_LECTURE":
                state["lesson_count"] += 1
                state["lecture_history"] = [] # 今回の発言ログはクリア
                state["current_score"] = 0     # スコアも一旦リセット
                # ※ original_text, themes, current_notebook は保持される
                
                await websocket.send_json({
                    "type": "RESTARTED",
                    "message": f"{state['lesson_count']}回目の授業ですね。よろしくお願いします！",
                    "themes": state["themes"]
                })

    except WebSocketDisconnect:
        print("先生が退出しました。")
    except Exception as e:
        print(f"エラー発生: {e}")
        await websocket.send_json({"type": "ERROR", "message": "マナブ君が混乱しています...もう一度お願いします。"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)