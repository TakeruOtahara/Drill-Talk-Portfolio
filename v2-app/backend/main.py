# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from logic import get_ai_client
import json
import base64
import io
from PIL import Image

app = FastAPI()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Drill-Talk V2 Backend (Voice & Drill Ready)"}

# --- WebSocket マネージャー ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

# --- 1. 音声会話用 WebSocket ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    ai = get_ai_client()
    print("🔌 WebSocket Connected!")
    
    try:
        while True:
            data = await websocket.receive_bytes()
            # AI思考 & 音声合成
            response_text = ai.generate_response(user_input=None, image=None, audio_bytes=data)
            audio_data = await ai.text_to_speech(response_text)
            audio_base64 = base64.b64encode(audio_data).decode("utf-8") if audio_data else None

            # 返送
            response_json = {
                "reply": response_text,
                "audio": audio_base64
            }
            await websocket.send_json(response_json)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("🔌 WebSocket Disconnected")
    except Exception as e:
        print(f"🔥 Error: {e}")
        manager.disconnect(websocket)

# --- 2. 【ここが重要】ドリル実行用エンドポイント ---
@app.post("/run-drill")
async def run_drill_endpoint(
    p: UploadFile = File(...),      # フロントエンドのformData.append("p", ...)に対応
    a: UploadFile = File(...),      # フロントエンドのformData.append("a", ...)に対応
    c: str = Form(...)              # フロントエンドのformData.append("c", ...)に対応
):
    print("📝 ドリル実行リクエスト受信")
    
    try:
        # 画像を読み込む
        problem_bytes = await p.read()
        answer_bytes = await a.read()
        
        problem_image = Image.open(io.BytesIO(problem_bytes))
        answer_key_image = Image.open(io.BytesIO(answer_bytes))
    except Exception as e:
        return {"error": f"画像の読み込み失敗: {e}"}

    # AIロジック呼び出し
    ai = get_ai_client()
    student_solution, score, reaction, knowledge_summary = ai.execute_drill(
        problem_image, 
        answer_key_image, 
        c
    )

    print(f"✅ 採点完了: {score}点")

    return {
        "solution": student_solution,
        "score": score,
        "reaction": reaction,
        "knowledge_summary": knowledge_summary
    }