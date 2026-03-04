require('dotenv').config();

// 모든 날짜 연산을 위해 타임존을 Asia/Seoul로 설정
process.env.TZ = 'Asia/Seoul';

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const passport = require('./config/passport');
const { auditLogger } = require('./middleware/audit');
const prisma = require('./lib/prisma');
const { PrismaSessionStore } = require('./lib/prisma-session-store');

const authRoutes = require('./routes/auth.routes');
const songRoutes = require('./routes/song.routes');
const adminRoutes = require('./routes/admin.routes');
const { youtubeCallback } = require('./controllers/youtube.controller');

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// 프록시 신뢰 설정
// 구조: Client → Cloudflare → cloudflared(Tunnel) → nginx → backend
// nginx가 X-Forwarded-For를 단일 실제 IP로 정규화해 전달하므로 1홉만 신뢰
app.set('trust proxy', 1);

// 필수 환경 변수 검증
if (!process.env.SESSION_SECRET) {
  console.error('[심각] SESSION_SECRET 환경 변수가 필요합니다');
  process.exit(1);
}

// 각 요청마다 CSP nonce 생성
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Helmet을 사용한 보안 헤더 설정 - unsafe-inline 없이 개선된 CSP
app.use((_req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", `'nonce-${res.locals.cspNonce}'`],
        scriptSrc: ["'self'", `'nonce-${res.locals.cspNonce}'`, "https://accounts.google.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://accounts.google.com"],
        frameSrc: ["https://accounts.google.com"], // Google OAuth 팝업용
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        reportUri: ['/api/csp-report'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1년
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
  })(_req, res, next);
});

// 인증 엔드포인트 Rate Limiting - 보안 강화됨
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 200, // 각 IP당 15분에 200회로 제한
  message: { error: '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// API 엔드포인트 Rate Limiting - 보안 강화됨
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 1200, // 각 IP당 1분에 1200회로 제한
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 다운로드 전용 Rate Limiting - yt-dlp+ffmpeg 프로세스 생성 비용 고려
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 20, // IP당 1분에 20회
  message: { error: '다운로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting 적용
app.use('/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/api/admin/wakeup/download', downloadLimiter);

// 화이트리스트 기반 CORS 설정 - 보안 강화됨
const allowedOrigins = [
  'https://spot.dgsw.site',
  process.env.FRONTEND_URL,
  // 개발 환경에서만 localhost 허용
  !isProduction && 'http://localhost:5173',
  !isProduction && 'http://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // 프로덕션에서는 origin 없는 요청(Postman 등) 차단
      return callback(null, !isProduction);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] 차단된 origin: ${origin}`);
    callback(new Error('CORS에 의해 허용되지 않음'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24시간
}));

app.use(express.json({ limit: '1mb' })); // DoS 방지를 위한 body 크기 제한
app.use(express.json({ type: 'application/csp-report', limit: '4kb' })); // CSP 위반 보고용
app.use(session({
  store: new PrismaSessionStore(prisma),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // 프로덕션에서만 HTTPS 강제
    httpOnly: true, // XSS 공격 방지
    // 'strict'로 변경 불가: YouTube OAuth 콜백이 accounts.google.com에서 리다이렉트될 때
    // 세션 쿠키가 전송되어야 youtubeOAuthState 검증이 동작함
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  },
  name: 'spot.sid', // 커스텀 세션 쿠키 이름
  rolling: true, // 각 요청마다 만료 시간 갱신
}));
app.use(passport.initialize());
app.use(passport.session());

// 절대 세션 만료 (rolling:true로 인해 활성 세션이 무기한 연장되는 것을 방지)
const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일
app.use((req, res, next) => {
  if (!req.session) return next();
  if (!req.session.createdAt) {
    req.session.createdAt = Date.now();
    return next();
  }
  if (Date.now() - req.session.createdAt > SESSION_ABSOLUTE_TTL_MS) {
    return req.session.destroy(() => {
      res.clearCookie('spot.sid');
      res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' });
    });
  }
  next();
});

app.use(auditLogger);

// 라우트 등록
app.use('/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/admin', adminRoutes);

// YouTube OAuth 콜백 (공개 엔드포인트)
app.get('/api/youtube/callback', youtubeCallback);

// CSP 위반 보고 수신 엔드포인트
app.post('/api/csp-report', (req, res) => {
  const report = req.body?.['csp-report'] || req.body;
  if (report) {
    console.warn('[CSP 위반]', JSON.stringify(report));
  }
  res.status(204).end();
});

// 헬스 체크
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    timezone: process.env.TZ || 'UTC',
  });
});

// 에러 처리 미들웨어
app.use((err, _req, res, _next) => {
  console.error('[오류]', err.message);

  // 프로덕션에서는 에러 상세 정보 숨김
  if (isProduction) {
    res.status(err.status || 500).json({
      error: '서버 오류가 발생했습니다.'
    });
  } else {
    res.status(err.status || 500).json({
      error: err.message,
      stack: err.stack
    });
  }
});

app.listen(PORT, () => {
  console.log(`[서버] 포트 ${PORT}에서 실행 중`);
  console.log(`[서버] 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[서버] 타임존: ${process.env.TZ || 'UTC'}`);
});
