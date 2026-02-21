FROM node:20-bookworm-slim

WORKDIR /app

# Required for YouTube audio extraction/transcoding
# yt-dlp: 버전 고정 + SHA256 검증으로 공급망 공격 방지
ARG YTDLP_VERSION=2026.02.04
ARG YTDLP_SHA256=f244941f771c922ffb63d64e17b8762d364b067f38a3caad60386496b3d226f7
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
  && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp \
  && echo "${YTDLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum -c - \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# 보안: 비루트 사용자로 실행
RUN useradd -r -s /bin/false appuser

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

USER appuser

# Migrations are managed externally via Turso CLI.
CMD ["node", "src/index.js"]
