# --- v3-app/backend/prompts.py ---

# Gemini 2.5 Flash 用の合体指示書
INITIAL_MATERIAL_PROMPT = """
この教材画像を解析し、以下の3点を【JSON形式】で出力してください。

1. "original_text": 
   教材の文字を一言一句正確に書き起こしたもの。図解がある場合は詳細に言語化すること。要約は厳禁。
2. "themes": 
   この内容から学習すべき大きなテーマを3〜5個抽出。各テーマの先頭に [?] をつけること。
3. "hidden_keywords": 
   理解度判定に使う重要な専門用語を15個程度。

出力は、Markdownの装飾（```json など）を除いた、純粋なJSONデータのみとしてください。
"""

# 相槌リスト（これは後で使います）
STATIC_BACKCHANNELS = [
    {"text": "なるほど！", "emotion": "happy"},
    {"text": "へぇー、そうなんですね！", "emotion": "happy"},
    {"text": "わかってきましたよ！", "emotion": "excited"},
    {"text": "メモメモ...", "emotion": "neutral"},
    {"text": "それってどういうことですか？", "emotion": "confused"},
    {"text": "すごい、わかりやすいです！", "emotion": "excited"},
]