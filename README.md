# SPOT

SPOT은 **대구소프트웨어마이스터고 방송부**의 노래 신청과 운영 관리를 위한 웹 서비스입니다.
학생은 기상송/점심방송을 신청하고, 방송부는 승인·거절·일정 관리·감사 로그 조회를 한곳에서 처리할 수 있습니다.

## 서비스 소개

### 해결하려는 문제
- 기존 노래 신청/관리 과정의 분산(채팅, 수기 관리, 별도 재생목록 작성)
- 운영 권한(학생/방송부원/방송부장)별 업무 분리가 어려운 문제
- 변경 이력 추적과 운영 감사의 어려움

### SPOT이 제공하는 것
- 학교 계정(`@dgsw.hs.kr`) 기반 로그인과 역할별 접근 제어
- 기상송/점심방송 신청부터 승인, 일정 관리, 재생목록 내보내기까지 통합
- 관리자 작업 감사 로그와 신청 안내 문구 실시간 관리

## 역할별 기능

### 공통
- Google OAuth 로그인
- 홈에서 기상송 일정/목록 확인
- 마이페이지에서 신청 이력과 상태 확인

### 학생 (`USER`)
- 기상송 신청
- 점심방송 신청
- 본인 `PENDING` 신청 취소

### 방송부원 (`MEMBER`)
- 점심방송 신청 승인/거절/일괄 승인
- 오늘 방송 목록을 YouTube 재생목록으로 내보내기
- 기상송 대기열 곡 삭제
- 오늘 기상송 MP3 다운로드

### 방송부장 (`LEADER`)
- 방송부원 기능 전체
- 기상송 승인/일정 변경/승인 취소
- 사용자 검색, 역할 변경, 차단/해제
- YouTube OAuth 연동 관리
- 신청 안내 문구 관리
- 감사 로그 조회

## 핵심 운영 규칙 (KST)

- 기상송 자동 승인: 매일 `08:00`, **3일 뒤 평일**에 최대 2곡 자동 승인
- 기상송 표시 기준:
  - `00:00 ~ 07:59`: 오늘
  - `08:00 ~ 23:59`: 내일
- 학생(`USER`) 기상송 신청 제한: 하루 1곡
- 점심방송 중복 제한: 같은 날 동일 곡(`video_id`) 중복 신청 방지
- 자동 정리:
  - 재생일이 지난 `APPROVED` 기상송 삭제
  - `REJECTED` 곡 7일 경과 시 삭제
- 세션 정리:
  - 매일 `03:00` + 6시간 주기 + 서버 시작 시 정리

## 기술 스택

- Backend: Node.js, Express, Prisma, Turso(libSQL)
- Frontend: React, Vite, Tailwind CSS v4
- 인증/세션: Passport Google OAuth2, express-session, Prisma Session Store
- 인프라: Docker Compose, Nginx, Cloudflare Tunnel
- PWA: vite-plugin-pwa, Workbox

## 프로젝트 구조

```text
.
├─ backend/
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ routes/
│  │  ├─ middleware/
│  │  ├─ lib/
│  │  └─ config/
│  └─ prisma/
├─ frontend/
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ components/
│  │  └─ context/
│  └─ nginx.conf
├─ scripts/
│  └─ turso/
├─ docker-compose.yml
└─ .env.example
```

## 환경 변수

### 파일 위치
- 로컬 백엔드 실행: `backend/.env`
- Docker Compose 실행: 루트 `.env`

### 필수 항목
- `SESSION_SECRET`: 세션 암호화 키
- `ENCRYPTION_KEY`: YouTube refresh token 암호화 키
- `TURSO_DATABASE_URL`: Turso URL (`libsql://...`)
- `DATABASE_URL`: Turso URL과 동일하게 설정
- `TURSO_AUTH_TOKEN`: Turso 인증 토큰
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `YOUTUBE_API_KEY`
- `FRONTEND_URL`

### 선택 항목
- `INITIAL_ADMIN_EMAIL`: 최초 `LEADER` 승격용 이메일
- `PRISMA_BOOTSTRAP_ON_START`: 컨테이너 시작 시 부트스트랩 여부
- `CLOUDFLARE_TUNNEL_TOKEN`: Cloudflare Tunnel 사용 시 필요

## 로컬 개발 실행

### 사전 요구사항
- Node.js 20+
- npm
- Turso DB 및 인증 토큰
- Google OAuth / YouTube API 설정

### 실행 순서

```bash
# 1) 의존성 설치
npm install
cd backend && npm install
cd ../frontend && npm install

# 2) 환경 변수 준비 (백엔드 로컬 실행용)
cd ..
cp .env.example backend/.env

# 3) 개발 서버 실행
npm run dev
```

로컬 기본 주소:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

주의:
- 현재 런타임 백엔드는 `TURSO_DATABASE_URL`(또는 libsql `DATABASE_URL`)이 반드시 필요합니다.
- 로컬에서 MP3 다운로드 기능을 테스트하려면 시스템에 `yt-dlp`와 `ffmpeg`가 필요합니다.

## Docker 배포

```bash
cp .env.example .env
# .env 값 채우기
docker-compose build
docker-compose up -d
```

구성:
- `frontend`: Nginx 정적 서빙 + `/auth`, `/api` 백엔드 프록시
- `backend`: Express API
- `cloudflared`: Tunnel 연결

주의:
- 현재 `docker-compose.yml`에는 호스트 포트 매핑이 없습니다.
- 외부 접근은 Cloudflare Tunnel 기준 구성입니다.

## Turso 마이그레이션

### 로컬 SQLite에서 Turso로 초기 이관

```bash
./scripts/turso/import-local-db.sh <db-name> backend/prisma/dev.db
```

### Prisma migration SQL 반영

```bash
./scripts/turso/apply-prisma-migrations.sh <db-name>
```

## API 개요

### Auth
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`

### Songs
- `GET /api/songs/today`
- `GET /api/songs/schedule`
- `GET /api/songs/daily` (공개)
- `GET /api/songs/search` (로그인 필요)
- `GET /api/songs/wakeup/queue` (로그인 필요)
- `GET /api/songs/my` (로그인 필요)
- `POST /api/songs/wakeup` (로그인 필요)
- `POST /api/songs/radio` (로그인 필요)
- `DELETE /api/songs/my/:id` (로그인 필요)

### Admin
- `GET /api/admin/wakeup/queue`
- `PATCH /api/admin/wakeup/:id/schedule`
- `PATCH /api/admin/wakeup/:id/unapprove`
- `DELETE /api/admin/wakeup/:id`
- `GET /api/admin/wakeup/download/:videoId`
- `GET /api/admin/radio/applications`
- `GET /api/admin/radio/playlist`
- `PATCH /api/admin/radio/approve-all`
- `PATCH /api/admin/radio/:id/approve`
- `PATCH /api/admin/radio/:id/reject`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/blacklist`
- `GET /api/admin/youtube/status`
- `GET /api/admin/youtube/auth`
- `POST /api/admin/youtube/export`
- `GET /api/admin/settings/apply-notice`
- `PATCH /api/admin/settings/apply-notice`
- `GET /api/admin/audit/logs`

## 보안/운영 포인트

- Helmet 기반 보안 헤더(CSP/HSTS 등)
- `express-rate-limit` 적용 (`/auth`, `/api`)
- CORS 화이트리스트 기반 허용
- 세션 쿠키 `httpOnly`, `sameSite=lax`, 프로덕션 `secure`
- 관리자 변경 요청 감사 로그 저장
- YouTube refresh token 암호화 저장(AES-256-GCM + PBKDF2)

## 주요 스크립트

루트 `package.json` 기준:

- `npm run dev`: 프론트/백엔드 동시 개발 실행
- `npm run build`: 프론트 빌드
- `npm run db:migrate`: 백엔드 Prisma migrate dev
- `npm run db:generate`: Prisma Client 생성
- `npm run docker:build`
- `npm run docker:up`
- `npm run docker:down`
- `npm run turso:import`
- `npm run turso:migrate`

## 문서

- 방송부장 운영 가이드: `docs/LEADER_GUIDE.md`
