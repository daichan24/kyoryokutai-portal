# Render / Linux 本番: システム Chromium で Puppeteer が動作するようにする
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    chromium \
    fonts-noto-cjk \
    fontconfig \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

# マイグレーション・条件付き seed は package.json の start:prod に集約（Render の Start Command もこれに合わせること）
CMD ["npm", "run", "start:prod"]
