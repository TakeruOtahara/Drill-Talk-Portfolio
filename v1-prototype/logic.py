# logic.py (Optimization Update)
import os
import re
from abc import ABC, abstractmethod
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
import prompts
from gtts import gTTS
import io

class AIClient(ABC):
    # 抽象メソッド（契約）は1つに絞る！
    @abstractmethod
    def execute_drill(self, problem_image: Image.Image, answer_key_image: Image.Image, context: str) -> tuple[str, int, str, str]:
        """
        引数: 問題画像, 正解画像, 会話履歴
        戻り値: (生徒の解答, 点数, リアクション, 抽出された知識の要約)
        """
        pass
    
class GeminiClient(AIClient):
    def __init__(self):
        self.client = genai.Client()
        # 直接書かずに、promptsファイルから持ってくる
        self.system_instruction_chat = prompts.SYSTEM_INSTRUCTION_CHAT
        self.system_instruction_grading = prompts.SYSTEM_INSTRUCTION_GRADING

    def generate_response(self, user_input: str, image: Image.Image = None, audio_bytes: bytes = None) -> str:
        
        try:
            contents = []
            if user_input: contents.append(user_input)
            if image: contents.append(image)
            if audio_bytes:
                contents.append(types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"))
            if not contents: return "（...）"
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_instruction_chat,
                    temperature=0.7,
                )
            )
            return response.text
        except Exception as e:
            return f"[System Error] {e}"
        
    def text_to_speech(self, text: str) -> bytes:
        """
        テキストを受け取り、MP3のバイト列（音声データ）を返す
        """
        try:
            # lang='ja' で日本語設定
            tts = gTTS(text=text, lang='ja')
            # ファイルではなくメモリ上(io.BytesIO)に保存する（高速化）
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            return fp.read()
        except Exception as e:
            print(f"TTS Error: {e}")
            return None

    # --- 新機能: 知識の圧縮 ---
    def _extract_knowledge(self, conversation_log: str) -> str:
        """
        長い会話ログから、学習内容（事実）だけを抽出して圧縮する
        """
        if not conversation_log:
            return "（特になし）"
            
        prompt = f"""
        以下の会話ログから、ユーザー（先生）が生徒（マナブ）に教えた「重要な学習事項・事実・キーワード」だけを抽出し、箇条書きでまとめなさい。
        挨拶や雑談、感情表現はすべて無視して削除すること。
        
        【会話ログ】
        {conversation_log}
        """
        try:
            # 2.0-flash-lite など軽量モデルを使うのが定石だが、今は共通で2.5を使う
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.0) # 事実抽出なので温度は0
            )
            return response.text
        except Exception:
            return conversation_log # エラー時は生のまま返す保険

    # --- ドリル実行（圧縮プロセス入り） ---
    # logic.py

    # 引数と戻り値の型を明記する
    def execute_drill(self, problem_image, answer_key_image, context):
        student_solution = ""
        score = 0
        reaction = "（採点不能）"
        knowledge_summary = "整理失敗"

        try:
            # --- 追加: 知識の整理ステップ ---
            knowledge_prompt = f"{prompts.KNOWLEDGE_EXTRACT_PROMPT}\n【会話履歴】\n{context}"
            
            knowledge_resp = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=knowledge_prompt,
                config=types.GenerateContentConfig(temperature=0.2)
            )
            knowledge_summary = knowledge_resp.text

            # --- Step 1: 問題を解く ---
            solve_prompt = prompts.DRILL_SOLVE_PROMPT_TEMPLATE.format(knowledge=knowledge_summary)
            
            solve_response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[solve_prompt, problem_image],
                config=types.GenerateContentConfig(
                    system_instruction=prompts.DRILL_SOLVE_INSTRUCTION,
                    temperature=0.3,
                )
            )
            student_solution = solve_response.text

            # --- Step 2: 採点 (省略せずに書く！) ---
            grade_prompt = prompts.DRILL_GRADE_PROMPT_TEMPLATE.format(solution=student_solution)
            
            grade_response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[grade_prompt, answer_key_image], 
                config=types.GenerateContentConfig(
                    system_instruction=self.system_instruction_grading,
                    temperature=0.8,
                )
            )
            grading_result_text = grade_response.text

            # --- Step 3: 結果解析 (ここで score を定義する！) ---
            score_match = re.search(r"点数:\s*(\d+)", grading_result_text)
            reaction_match = re.search(r"リアクション:\s*(.*)", grading_result_text, re.DOTALL)
            
            # ここで score という名前の変数に値を代入！
            score = int(score_match.group(1)) if score_match else 0
            reaction = reaction_match.group(1).strip() if reaction_match else grading_result_text

            return student_solution, score, reaction, knowledge_summary
        
        except Exception as e:
            # エラー時も score が定義されている状態なので安心
            return f"エラー: {e}", score, reaction, knowledge_summary

def get_ai_client() -> AIClient:
    load_dotenv()
    if os.getenv("AI_PROVIDER", "GOOGLE") == "GOOGLE": return GeminiClient()
    else: raise ValueError("Unknown Provider")