# --- v3-app/backend/Dockerfile ---

# 1. ベース画像（Python環境）を指定
FROM python:3.11-slim

# 💡 修正ポイント1: ログのリアルタイム出力を強制（インフラ監視・Log Analytics用）
ENV PYTHONUNBUFFERED=1

# 💡 修正ポイント2: セキュリティ向上のための非rootユーザー作成（ゼロトラスト原則）
RUN addgroup --system appgroup && adduser --system --group appuser

# 2. コンテナ内の作業ディレクトリを設定
WORKDIR /app

# 3. 依存関係ファイルをコピーしてインストール
# キャッシュを効かせるため、ソースコード全体より先にコピーする
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock

# 4. バックエンドのソースコードを全てコピー
COPY . .

# 🛡️ アプリケーションディレクトリの所有権を非rootユーザーに変更
RUN chown -R appuser:appgroup /app

# 🛡️ 実行ユーザーを root から appuser に切り替え
USER appuser

# 5. アプリケーションを起動（ポート8000で待ち受け）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]