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

# Install all dependencies (including devDependencies for prisma CLI)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Expose port
EXPOSE 4000

# For Turso, schema/data migration should be executed externally with Turso CLI.
CMD ["sh", "-c", "if [ \"$PRISMA_BOOTSTRAP_ON_START\" = \"true\" ]; then npx prisma migrate deploy && npx prisma db seed; fi; node src/index.js"]
