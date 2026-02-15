# SPOT

SPOT은 대구소프트웨어마이스터고 방송부의 노래 신청과 방송 운영을 위한 웹 서비스입니다.  
학생 신청부터 방송부 승인, 운영 감사 로그까지 한 시스템에서 처리합니다.

## 서비스 기능

### 1) 공통
- Google OAuth(`@dgsw.hs.kr`) 로그인
- 홈에서 기상송 목록/일정 확인
- 마이페이지에서 신청 기록 확인

### 2) 학생(`USER`)
- 기상송 신청
- 점심방송 신청
- 본인 `대기중(PENDING)` 신청 취소

### 3) 방송부원(`MEMBER`)
- 점심방송 신청 승인/거절/일괄 승인
- 오늘 방송 목록 기반 YouTube 재생목록 내보내기
- 기상송 대기열 삭제

### 4) 방송부장(`LEADER`)
- 방송부원 기능 전체
- 기상송 스케줄 승인/변경/승인 취소
- 사용자 검색/차단/역할 변경
- 신청 안내 문구 관리
- 감사 로그 조회
- YouTube OAuth 연동 관리

## 핵심 운영 로직 (KST)

- 기상송 자동 승인: 매일 08:00, `3일 뒤` 날짜로 최대 2곡 승인
- 기상송 표시 기준:
  - `00:00 ~ 07:59`: 오늘 기상송
  - `08:00 ~ 23:59`: 내일 기상송
- 신청 제한:
  - `USER`는 기상송 하루 1곡 제한
- 자동 정리:
  - 승인 후 재생일이 지난 곡 삭제
  - 거절 후 7일 지난 곡 삭제
- 감사 로그:
  - 관리자 API의 변경 요청(`POST/PUT/PATCH/DELETE`) 중심 기록
  - `304` 응답은 저장/조회 제외

## 기술 스택

- Backend: Node.js, Express, Prisma, Turso(libSQL)
- Frontend: React, Vite, Tailwind CSS v4
- Auth/Session: Passport Google OAuth2, express-session, Prisma(Turso) session store
- Infra: Docker Compose, Nginx, Cloudflare Tunnel(선택)
- PWA: `vite-plugin-pwa` + Workbox

## 프로젝트 구조

```text
.
├─ backend/      # API, 인증, 스케줄러, Prisma
├─ frontend/     # React UI, PWA, 관리자 화면
├─ docker-compose.yml
└─ .env.example
```

## 환경 변수

실행 방식에 따라 `.env` 위치가 다릅니다.

- 로컬 직접 실행(`cd backend && npm run dev`): `backend/.env`
- Docker Compose 실행: 루트 `.env`

주요 키:
- `SESSION_SECRET`, `ENCRYPTION_KEY`
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DATABASE_URL`(Turso URL과 동일)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `YOUTUBE_API_KEY`
- `FRONTEND_URL`
- `INITIAL_ADMIN_EMAIL`
- `CLOUDFLARE_TUNNEL_TOKEN` (Cloudflare Tunnel 사용 시)

## 로컬 개발 실행

```bash
# 1) 의존성 설치
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# 2) 환경 변수 준비 (로컬용)
cp .env.example backend/.env

# 3) Prisma 준비
cd backend
npx prisma migrate dev
npx prisma generate
cd ..

# 4) 실행
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Turso 마이그레이션 (CLI)

### 1) Turso 로그인

```bash
turso auth login
```

### 2) 로컬 SQLite를 Turso로 이관

```bash
# <db-name> 예: spot-prod
./scripts/turso/import-local-db.sh <db-name> backend/prisma/dev.db
```

또는

```bash
npm run turso:import -- <db-name> backend/prisma/dev.db
```

실행이 끝나면 출력된 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` 값을 `.env` 또는 `backend/.env`에 설정합니다.

### 3) 이후 신규 Prisma migration SQL 반영

```bash
./scripts/turso/apply-prisma-migrations.sh <db-name>
```

또는

```bash
npm run turso:migrate -- <db-name>
```

## Docker 배포 실행

```bash
# Docker용 환경변수는 루트에 위치
cp .env.example .env
docker-compose build
docker-compose up -d
```

- Frontend: `http://localhost:3000`
- Backend(API): Frontend를 통해 `/auth`, `/api` 프록시 접근

DB 경로 정책:
- 앱 데이터/세션 DB 모두 Turso만 사용
- `DATABASE_URL`은 Turso URL(`libsql://...`)로 `TURSO_DATABASE_URL`과 동일하게 설정
- 로컬 SQLite 파일(`backend/prisma/*.db`)은 운영 경로에 사용하지 않음
- 컨테이너 시작 시 자동 마이그레이션/시드는 기본 비활성화이며, 필요할 때만 `PRISMA_BOOTSTRAP_ON_START=true` 설정
