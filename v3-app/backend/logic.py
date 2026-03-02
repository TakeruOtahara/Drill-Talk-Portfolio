# --- v3-app/backend/logic.py ---
import os
import json
from google import genai
from google.genai import types
from prompts import INITIAL_MATERIAL_PROMPT, FINAL_NOTEBOOK_PROMPT, STUDENT_QUESTION_PROMPT

class GeminiProvider:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY が .env に設定されていません。")
        
        self.client = genai.Client(api_key=api_key)
        self.model_id = "gemini-2.5-flash"
        self.hidden_keywords = []

    async def process_initial_material(self, image_bytes):
        """
        教材画像から原本・テーマ・キーワードを初回生成
        """
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

        response = self.client.models.generate_content(
            model=self.model_id,
            contents=[INITIAL_MATERIAL_PROMPT, image_part],
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )

        data = json.loads(response.text)
        self.hidden_keywords = data.get("hidden_keywords", [])
        return data.get("original_text", ""), data.get("themes", [])

    def calculate_score(self, user_text, current_score):
        """
        キーワード照合によるスコアリング（API通信なし）
        """
        match_count = 0
        for kw in self.hidden_keywords:
            if kw in user_text:
                match_count += 1
        return min(current_score + (match_count * 5), 100)

    async def generate_student_question(self, current_notebook, original_text, current_themes):
        """
        「質問ある？」への回答生成。ノートの不足分を突っ込む
        """
        prompt = f"{STUDENT_QUESTION_PROMPT}\n\n原本:\n{original_text}\n\n現在のノート:\n{current_notebook}\n\n現在のテーマ:\n{current_themes}"
        
        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt
        )
        return response.text

    async def generate_final_note(self, lecture_history, original_text, current_themes, previous_notebook=""):
        """
        原本 + 今回のログ + 前回のノートを比較して、最新ノートを作成
        """
        all_user_text = " ".join(lecture_history)
        
        # 3者の比較指示。何回目（3回目、4回目...）でも機能する。
        prompt = (
            f"{FINAL_NOTEBOOK_PROMPT}\n\n"
            f"【原本（絶対的な正解）】\n{original_text}\n\n"
            f"【前回のノート（これまでの理解）】\n{previous_notebook}\n\n"
            f"【今回の先生の説明（最新の追加情報）】\n{all_user_text}\n\n"
            f"【現在のテーマ状態】\n{current_themes}"
        )

        response = self.client.models.generate_content(
            model=self.model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )

        data = json.loads(response.text)
        
        # テーマの [?] -> [OK] 書き換え処理
        completed = data.get("completed_themes", [])
        updated_themes = []
        for theme in current_themes:
            if any(c_title in theme for c_title in completed):
                updated_themes.append(theme.replace("[?]", "[OK]"))
            else:
                updated_themes.append(theme)

        return {
            "notebook": data.get("notebook_html", ""),
            "themes": updated_themes
        }