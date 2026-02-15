# SPOT

대구소프트웨어마이스터고 방송부 노래 신청/운영 서비스.

## 핵심 기능

- 기상송 신청, 대기열, 자동 승인
- 점심방송 신청, 승인/일괄 승인, YouTube 재생목록 내보내기
- 권한 기반 관리
  - `USER`: 학생
  - `MEMBER`: 방송부원
  - `LEADER`: 방송부장
- 사용자 차단/역할 변경/감사 로그
- PWA(설치형 웹앱) 지원

## 시간 기준 (KST)

- 자동 승인: 매일 오전 8시, `3일 뒤` 날짜로 승인
- 자동 승인 수량: 날짜당 최대 2곡
- 화면 표시:
  - `00:00 ~ 07:59` 오늘 기상송
  - `08:00 ~ 23:59` 내일 기상송

## 기술 스택

- Backend: Node.js, Express, Prisma, SQLite
- Frontend: React, Vite, Tailwind CSS v4
- Infra: Docker Compose, Cloudflare Tunnel(선택)

## 로컬 개발 실행

```bash
# 1) 의존성 설치
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# 2) 환경 변수
cp backend/.env.example backend/.env

# 3) DB 준비
cd backend
npx prisma migrate dev
npx prisma generate
cd ..

# 4) 실행 (backend:4000, frontend:5173)
npm run dev
```

## Docker 실행

```bash
# 1) 루트 .env 작성
cp .env.example .env

# 2) 컨테이너 실행
docker-compose build
docker-compose up -d
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

Cloudflare Tunnel을 사용하지 않으면 `docker-compose.yml`의 `cloudflared` 서비스를 제거하거나 비활성화하세요.
