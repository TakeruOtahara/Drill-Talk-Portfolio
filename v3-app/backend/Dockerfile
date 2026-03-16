# 1. ベース画像（Python環境）を指定
FROM python:3.11-slim

# 2. コンテナ内の作業ディレクトリを設定
WORKDIR /app

# 3. 依存関係ファイルをコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. バックエンドのソースコードを全てコピー
COPY . .

# 5. アプリケーションを起動（ポート8000で待ち受け）
# --host 0.0.0.0 は「外部からの接続を許可する」ための必須設定です
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]