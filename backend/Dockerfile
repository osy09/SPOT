FROM node:20-bookworm-slim

WORKDIR /app

# YouTube 오디오 추출·트랜스코딩에 필요
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

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치 (prisma generate에 devDependencies 필요)
RUN npm ci

# prisma 스키마 복사 및 클라이언트 생성
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

# 소스 코드 복사
COPY src ./src

# 포트 노출
EXPOSE 4000

USER appuser

# 마이그레이션은 Turso CLI를 통해 외부에서 관리.
CMD ["node", "src/index.js"]
