# --- main.py ---
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
import os
import base64
from logic import GeminiProvider

load_dotenv() # .envを読み込みます

app = FastAPI()
ai_brain = GeminiProvider()

@app.websocket("/ws/manabu")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("【接続】フロントエンドとつながりました")

    # セッション用変数
    original_text = ""
    themes = []
    current_score = 0

    try:
        while True:
            # JSON形式でデータを受け取る
            data = await websocket.receive_json()

            # ステップ1：画像の初期処理
            if data.get("type") == "INIT_MATERIAL":
                print("【処理中】教材画像を解析しています...")
                
                # Base64形式の画像データをデコードしてバイナリにします
                image_bytes = base64.b64decode(data["image_base64"])
                
                # logic.pyの機能を使って原本とテーマを作成
                # ※ ここで「隠しキーワード」も裏側で保存されます
                original_text, themes = await ai_brain.process_initial_material(
                    {"mime_type": "image/jpeg", "data": image_bytes}
                )

                # ユーザーには「テーマリスト」だけを返します
                await websocket.send_json({
                    "type": "MATERIAL_READY",
                    "themes": themes,
                    "original_preview": original_text[:100] + "..." # 確認用
                })
                print("【完了】原本とテーマの準備ができました")

    except WebSocketDisconnect:
        print("【切断】バイバイ！")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)