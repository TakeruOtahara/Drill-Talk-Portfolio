# --- v3-app/backend/logic.py ---
import os
import json
import asyncio
import random
import logging
from google import genai
from google.genai import types
from prompts import INITIAL_MATERIAL_PROMPT, FINAL_NOTEBOOK_PROMPT, STUDENT_QUESTION_PROMPT

# 💡 ロガーの設定
logger = logging.getLogger("drilltalk.logic")

class GeminiProvider:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY が .env に設定されていません。")
        
        self.client = genai.Client(api_key=api_key)
        self.model_id = "gemini-2.5-flash" 

    def _clean_json_string(self, raw_text: str) -> str:
        """Geminiが返してくるMarkdown記号を削除する"""
        text = raw_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    async def _generate_with_retry(self, contents, config=None, max_retries=3):
        """
        指数バックオフによるリトライ処理。
        既知の API エラー (503/429) の場合はログを簡潔に保ち、
        それ以外の未知のエラーのみ詳細なスタックトレースを出力する。
        """
        base_delay = 2 
        for i in range(max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=contents,
                    config=config
                )
                return response
            except Exception as e:
                error_str = str(e)
                # 503 (Unavailable) または 429 (Too Many Requests) の判定
                is_throttled = "503" in error_str or "429" in error_str

                if is_throttled and i < max_retries:
                    delay = (base_delay * (2 ** i)) + (random.uniform(0, 1))
                    logger.warning(f"⚠️ API混雑中 (Attempt {i+1}/{max_retries}). {delay:.2f}秒後に再試行...")
                    await asyncio.sleep(delay)
                    continue
                
                # 💡 【SE仕様】エラーの仕分け
                if is_throttled:
                    # 既知のインフラ負荷エラー：スタックトレースなしで1行出力
                    logger.error(f"❌ APIリミット到達（試行終了）: {error_str}")
                else:
                    # 未知の致命的エラー：デバッグのためスタックトレースを含めて出力
                    logger.error(f"❌ 予期せぬAPIエラーが発生しました: {error_str}", exc_info=True)
                
                raise e

    async def process_initial_material(self, image_bytes_list):
        """画像から教材要素を抽出。パース失敗時はプロセスの停止を避ける。"""
        safe_list = image_bytes_list[:5]
        image_parts = [
            types.Part.from_bytes(data=b, mime_type="image/jpeg") 
            for b in safe_list
        ]

        try:
            response = await self._generate_with_retry(
                contents=[INITIAL_MATERIAL_PROMPT] + image_parts,
                config=types.GenerateContentConfig(response_mime_type='application/json')
            )
            cleaned_text = self._clean_json_string(response.text)
            data = json.loads(cleaned_text)
            return data.get("original_text", ""), data.get("structured_original", {})
        except Exception as e:
            # logic層でのエラーは上位のmain.pyに委ねるが、ログは残す
            logger.warning(f"⚠️ [INIT_MATERIAL] 処理中断: {str(e)}")
            return "", {}

    async def generate_student_question(self, all_user_text, structured_original):
        """講義内容に基づいたリアルタイムな質問生成。"""
        prompt = f"{STUDENT_QUESTION_PROMPT}\n\n【教材の4要素】\n{json.dumps(structured_original, ensure_ascii=False)}\n\n【先生のこれまでの説明】\n{all_user_text}"
        response = await self._generate_with_retry(contents=prompt)
        return response.text

    async def generate_final_note(self, lecture_history, original_text, structured_original, user_memo):
        """原本と説明ログを比較し、メタ認知能力を評価する最終ノート生成。"""
        all_user_text = " ".join(lecture_history)
        
        prompt = (
            f"{FINAL_NOTEBOOK_PROMPT}\n\n"
            f"【教材の原本】\n{original_text}\n\n"
            f"【教材の4要素（正解）】\n{json.dumps(structured_original, ensure_ascii=False)}\n\n"
            f"【先生の説明ログ】\n{all_user_text}\n\n"
            f"【先生による『忘れたことメモ』（自己申告）】\n{user_memo}\n\n"
            "指示：原本と説明ログを比較して教え漏れを抽出してください。その際、先生の『忘れたことメモ』も確認してください。"
            "メタ認知能力を評価に反映してください。"
        )

        try:
            response = await self._generate_with_retry(
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type='application/json')
            )
            cleaned_text = self._clean_json_string(response.text)
            data = json.loads(cleaned_text)
            return {
                "notebook_html": data.get("notebook_html", "<h3>解析エラー</h3><p>内容を生成できませんでした。</p>"),
                "missing_points": data.get("missing_points", []),
                "misconceptions": data.get("misconceptions", [])
            }
        except Exception as e:
            logger.warning(f"⚠️ [FINAL_NOTE] 解析失敗: {str(e)}")
            return {
                "notebook_html": "<h3>マナブ君が少し混乱しています</h3><p>APIエラーが発生しました。もう一度お試しください。</p>",
                "missing_points": ["解析エラー"],
                "misconceptions": []
            }