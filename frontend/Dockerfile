# --- v3-app/frontend/Dockerfile ---

# --- ビルド用ステージ ---
FROM node:20-alpine AS builder

# Alpine LinuxでSWC（コンパイラ）を動かすための必須ライブラリ
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 💡 修正ポイント：ビルド引数（ARG）を定義し、デフォルト値に「ローカル用」を設定します。
# これにより、ローカルで普通にビルドする時は自動的に localhost:8000 になります。
ARG BACKEND_URL=http://localhost:8000

# 🛡️ Next.jsのビルドプロセス（npm run build）に引数の値を引き渡します
ENV BACKEND_URL=$BACKEND_URL

# 🛡️ ブラウザに露出する NEXT_PUBLIC_ 変数は不要になったため削除
RUN npm run build

# --- 実行用ステージ（軽量化） ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]