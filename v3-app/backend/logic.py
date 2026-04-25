# --- v3-app/backend/logic.py ---
import os
import json
import asyncio
import random
import logging
from google import genai
from google.genai import types
from prompts import (
    INITIAL_MATERIAL_PROMPT, 
    FINAL_NOTEBOOK_PROMPT, 
    STUDENT_QUESTION_PROMPT
)

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

    def _ensure_dict(self, data):
        """
        💡 【堅牢性】リスト形式([{}])で来ても辞書形式({})に変換する。
        AIが形式を誤っても中身を救出し、AttributeErrorを防ぐ。
        """
        if isinstance(data, list):
            if len(data) > 0:
                logger.info("📦 Geminiがリスト形式で返しましたが、先頭データを抽出して継続します。")
                return data[0]
            else:
                logger.warning("⚠️ 返却されたリストが空です。")
                return {}
        return data

    async def _generate_with_retry(self, contents, config=None, max_retries=3):
        """指数バックオフによるリトライ処理。インフラ負荷(503/429)と未知のエラーを仕分けしてログ出力。"""
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
                is_throttled = "503" in error_str or "429" in error_str

                if is_throttled and i < max_retries:
                    delay = (base_delay * (2 ** i)) + (random.uniform(0, 1))
                    logger.warning(f"⚠️ API混雑中 (Attempt {i+1}/{max_retries}). {delay:.2f}秒後に再試行...")
                    await asyncio.sleep(delay)
                    continue
                
                if is_throttled:
                    logger.error(f"❌ APIリミット到達（試行終了）: {error_str}")
                else:
                    logger.error(f"❌ 予期せぬAPIエラーが発生しました: {error_str}", exc_info=True)
                raise e

    async def process_initial_material(self, image_bytes_list):
        """画像から教材要素を抽出。パース失敗時は None を返し main.py のエラー通知を起動させる。"""
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
            raw_data = json.loads(cleaned_text)
            
            # 揺らぎを吸収
            data = self._ensure_dict(raw_data)
            
            # original_text または structured_original が欠落している場合も異常とみなす
            if "original_text" not in data or "structured_original" not in data:
                raise ValueError("必要なキー(original_text/structured_original)がJSONに含まれていません。")

            return data.get("original_text", ""), data.get("structured_original", {})
        
        except Exception as e:
            logger.warning(f"⚠️ [INIT_MATERIAL] 処理中断: {str(e)}")
            # None を返すことで main.py 側の ERROR 送信ロジックを動かす
            return None, None

    async def generate_student_question(self, all_user_text, structured_original):
        """講義ログに基づいたマナブ君の質問生成"""
        prompt = f"{STUDENT_QUESTION_PROMPT}\n\n【教材の4要素】\n{json.dumps(structured_original, ensure_ascii=False)}\n\n【先生のこれまでの説明】\n{all_user_text}"
        response = await self._generate_with_retry(contents=prompt)
        return response.text

    async def generate_final_note(self, lecture_history, original_text, structured_original, user_memo):
        """原本・ログ・メモの3点を照合し、客観的なメタ認知分析を行う"""
        all_user_text = " ".join(lecture_history)
        
        # prompts.py の命令文と動的なデータを結合
        prompt = (
            f"{FINAL_NOTEBOOK_PROMPT}\n\n"
            f"【教材の原本】\n{original_text}\n\n"
            f"【教材の4要素（正解）】\n{json.dumps(structured_original, ensure_ascii=False)}\n\n"
            f"【先生の説明ログ】\n{all_user_text}\n\n"
            f"【先生による『忘れたことメモ』】\n{user_memo}"
        )

        try:
            response = await self._generate_with_retry(
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type='application/json')
            )
            cleaned_text = self._clean_json_string(response.text)
            raw_data = json.loads(cleaned_text)
            
            # リスト形式をガード
            data = self._ensure_dict(raw_data)
            
            return {
                "notebook_html": data.get("notebook_html", "<h3>解析エラー</h3><p>内容を生成できませんでした。</p>"),
                "missing_points": data.get("missing_points", []),
                "misconceptions": data.get("misconceptions", [])
            }
        except Exception as e:
            logger.warning(f"⚠️ [FINAL_NOTE] 解析失敗: {str(e)}")
            return {
                "notebook_html": "<h3>マナブ君が少し混乱しています</h3><p>APIエラーにより評価を生成できませんでした。</p>",
                "missing_points": ["解析エラー"],
                "misconceptions": []
            }