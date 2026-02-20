FROM node:20-bookworm-slim

WORKDIR /app

# Required for YouTube audio extraction/transcoding
# yt-dlp: apt 버전은 오래되어 YouTube 호환성 문제가 있으므로 GitHub 최신 바이너리 직접 설치
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (devDependencies needed for prisma generate)
RUN npm ci

# Copy prisma schema and generate client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

# Copy source code
COPY src ./src

# Expose port
EXPOSE 4000

# Migrations are managed externally via Turso CLI.
CMD ["node", "src/index.js"]
