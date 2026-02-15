require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const { startScheduler } = require('./lib/scheduler');
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

// Trust proxy - required for Cloudflare Tunnel and secure cookies
app.set('trust proxy', 1);

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  console.error('[CRITICAL] SESSION_SECRET environment variable is required');
  process.exit(1);
}

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for popup windows
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for OAuth popup windows
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 50 requests per 15 minutes (relaxed for testing)
  message: { error: '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30000, // Limit each IP to 300 requests per minute (relaxed for initial deployment)
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/auth', authLimiter);
app.use('/api', apiLimiter);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  store: new PrismaSessionStore(prisma),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax', // CSRF protection (use 'strict' if no cross-site requests needed)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(auditLogger);

// Routes
app.use('/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/admin', adminRoutes);

// YouTube OAuth callback (public endpoint)
app.get('/api/youtube/callback', youtubeCallback);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start scheduler
startScheduler();

app.listen(PORT);
