# --- ビルド用ステージ ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# .env.local ではなく、ビルド時に必要な環境変数があればここで定義
RUN npm run build

# --- 実行用ステージ（軽量化） ---
FROM node:20-alpine AS runner
WORKDIR /app

# 本番環境であることを指定
ENV NODE_ENV production

# builderステージから必要なファイルだけをコピー
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# ポート3000で起動
EXPOSE 3000
CMD ["npm", "start"]