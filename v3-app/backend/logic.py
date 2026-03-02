# --- v3-app/backend/logic.py ---
import os
import json
from google import genai
from google.genai import types
from prompts import INITIAL_MATERIAL_PROMPT # ← これを読み込みます

class GeminiProvider:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY が .env に設定されていません。")
        
        self.client = genai.Client(api_key=api_key)
        self.model_id = "gemini-2.5-flash" # 最新モデル！
        self.hidden_keywords = []

    async def process_initial_material(self, image_bytes):
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

        # 2.5 Flash に1回だけリクエスト
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=[INITIAL_MATERIAL_PROMPT, image_part],
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )

        data = json.loads(response.text)
        
        original_text = data.get("original_text", "")
        themes = data.get("themes", [])
        self.hidden_keywords = data.get("hidden_keywords", [])

        return original_text, themes

    def calculate_score(self, user_text, current_score):
        match_count = 0
        for kw in self.hidden_keywords:
            if kw in user_text:
                match_count += 1
        return min(current_score + (match_count * 5), 100)