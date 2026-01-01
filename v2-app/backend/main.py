# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from logic import get_ai_client
import json
import base64

app = FastAPI()

# CORS設定（WebSocketでも重要です）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 開発中はフル開放
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Drill-Talk V2 Backend (WebSocket Ready)"}

# --- WebSocket マネージャー ---
# 複数の接続を管理するクラス（今回は1対1ですが、将来のために用意）
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

# --- WebSocket エンドポイント ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    ai = get_ai_client()
    print("🔌 WebSocket Connected!")
    
    try:
        while True:
            # 1. フロントエンドからデータを受け取る（待機）
            # ここでは音声データ(bytes)が飛んでくる想定
            data = await websocket.receive_bytes()
            print(f"🎤 音声データ受信: {len(data)} bytes")

            # 2. AIに聞かせる
            response_text = ai.generate_response(user_input=None, image=None, audio_bytes=data)
            print(f"🤖 思考結果: {response_text}")

            # 3. 音声合成 (TTS)
            # ★ここが変わった！ await をつける
            audio_data = await ai.text_to_speech(response_text)
            audio_base64 = base64.b64encode(audio_data).decode("utf-8") if audio_data else None

            # 4. JSONで返送する
            response_json = {
                "reply": response_text,
                "audio": audio_base64
            }
            await websocket.send_json(response_json)
            print("📤 返答送信完了")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("🔌 WebSocket Disconnected")
    except Exception as e:
        print(f"🔥 Error: {e}")
        manager.disconnect(websocket)