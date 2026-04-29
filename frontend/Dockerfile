# --- v3-app/frontend/Dockerfile ---

# --- ビルド用ステージ ---
FROM node:20-alpine AS builder

# 💡 修正ポイント1: Alpine LinuxでSWC（コンパイラ）を動かすための必須ライブラリを追加
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 🛡️ 直書きは一切しない。器（ARG）だけ用意する
ARG NEXT_PUBLIC_DRILLTALK_API_KEY
ARG NEXT_PUBLIC_WS_URL

# 💡 これをセットすることで、次の npm run build が値を拾えるようになる
ENV NEXT_PUBLIC_DRILLTALK_API_KEY=$NEXT_PUBLIC_DRILLTALK_API_KEY
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build


# --- 実行用ステージ（軽量化） ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 💡 修正ポイント2: standaloneモードで生成された「実行に必要な最小限のファイル」だけをコピーする
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 💡 修正ポイント3: npm start ではなく、自動生成された実行ファイル（server.js）を直接叩く
CMD ["node", "server.js"]