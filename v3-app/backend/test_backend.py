import os
import asyncio
import random
from dotenv import load_dotenv
from logic import GeminiProvider
from prompts import STATIC_BACKCHANNELS # 相槌リストを読み込み

load_dotenv()

async def test_ocr():
    # 1. マナブ君（AI）を準備（ここで ai_brain が定義される）
    print("--- マナブ君、起動中... ---")
    ai_brain = GeminiProvider()

    # 2. テスト用の画像ファイルを読み込む
    image_path = "test_material.jpeg" # あなたのファイル名に合わせています
    
    if not os.path.exists(image_path):
        print(f"エラー: {image_path} が見つかりません。")
        return

    print(f"--- '{image_path}' を解析しています... ---")
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # 解析実行（原本・テーマ・キーワードを一度に取得）
    original, themes = await ai_brain.process_initial_material(image_bytes)

    # 結果の表示
    print("\n=== 【原本】一言一句テキスト（冒頭200文字） ===")
    print(original[:200] + "...")

    print("\n=== 【テーマ】ユーザーに見せる目次 ===")
    for t in themes:
        print(t)

    print("\n=== 【隠しキーワード】スコア判定用 ===")
    print(ai_brain.hidden_keywords)

    # --- STEP 3: リアルタイム・スコアリングのテスト ---
    # ai_brain が生きているこの「関数の中」で実行します
    print("\n" + "="*30)
    print("【テスト】擬似授業スタート！")
    print("="*30)

    # 先生（ユーザー）の擬似発言リスト
    fake_speeches = [
        "今日は適応免疫について解説します。",
        "まず、白血球の一種であるリンパ球が重要です。",
        "リンパ球にはT細胞とB細胞という種類がありますね。",
        "これらは非常に特異性が高いのが特徴です。"
    ]

    test_score = 0
    for speech in fake_speeches:
        print(f"\n先生：『{speech}』")
        
        # logic.py の計算メソッドを呼び出す
        test_score = ai_brain.calculate_score(speech, test_score)
        
        # 相槌をランダムに取得
        reaction = random.choice(STATIC_BACKCHANNELS)
        
        print(f"マナブ：「{reaction['text']}」 (感情: {reaction['emotion']})")
        print(f"現在の理解度スコア: {test_score}%")
    
    # --- STEP 4: 本領発揮（要約・評価）のテスト ---
    print("\n" + "="*30)
    print("【テスト】マナブ君の本領発揮！")
    print("="*30)
    
    # 意図的に「間違った説明（B細胞が食作用を持つ、など）」を混ぜた履歴を渡してみる
    test_history = fake_speeches + ["B細胞は、パクパクと異物を食べて処理する食細胞の一種です。"]
    
    result = await ai_brain.generate_final_note(test_history, original, themes)
    
    print("\n=== マナブの復習ノート ===")
    print(result["notebook"])
    
    print("\n=== 更新されたテーマ一覧 ===")
    for ut in result["themes"]:
        print(ut)

    print("\n--- テスト終了 ---")

if __name__ == "__main__":
    asyncio.run(test_ocr())