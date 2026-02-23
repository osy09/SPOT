const prisma = require('../lib/prisma');

const MAX_BODY_LENGTH = 4000;
const MAX_QUERY_LENGTH = 2000;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_IP_LENGTH = 120;
const AUDIT_ALLOWED_ROLES = new Set(['MEMBER', 'LEADER']);
const AUDIT_ALLOWED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function safeJson(value, maxLength) {
  if (value === undefined || value === null) return null;
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return null;
    return serialized.length > maxLength
      ? `${serialized.slice(0, maxLength)}...`
      : serialized;
  } catch {
    return null;
  }
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const masked = { ...payload };
  const sensitiveKeys = [
    'password',
    'access_token',
    'refresh_token',
    'token',
    'session',
    'code',
    'state',
  ];

  for (const key of sensitiveKeys) {
    if (Object.prototype.hasOwnProperty.call(masked, key)) {
      masked[key] = '[REDACTED]';
    }
  }

  return masked;
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim().slice(0, MAX_IP_LENGTH);
  }
  if (req.ip) {
    return String(req.ip).slice(0, MAX_IP_LENGTH);
  }
  return null;
}

function shouldAuditLog({ userSnapshot, method, path }) {
  if (!userSnapshot || !userSnapshot.id) return false;
  if (!AUDIT_ALLOWED_ROLES.has(userSnapshot.role)) return false;
  if (!AUDIT_ALLOWED_METHODS.has(method)) return false;
  // 관리자 API의 관리 변경 요청만 감사 로그 기록.
  return path.startsWith('/api/admin/');
}

function auditLogger(req, res, next) {
  const startedAt = Date.now();
  const userSnapshot = req.user
    ? {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
      }
    : null;

  const method = req.method;
  const path = req.originalUrl.split('?')[0];
  const query = safeJson(sanitizePayload(req.query), MAX_QUERY_LENGTH);
  const body = method === 'GET' || method === 'HEAD'
    ? null
    : safeJson(sanitizePayload(req.body), MAX_BODY_LENGTH);
  const ip = getClientIp(req);
  const userAgent = req.get('user-agent')
    ? req.get('user-agent').slice(0, MAX_USER_AGENT_LENGTH)
    : null;
  const shouldLog = shouldAuditLog({ userSnapshot, method, path });

  res.on('finish', async () => {
    if (!shouldLog || res.statusCode === 304) return;

    try {
      await prisma.auditLog.create({
        data: {
          user_id: userSnapshot.id,
          user_email: userSnapshot.email || null,
          user_name: userSnapshot.name || null,
          user_role: userSnapshot.role || null,
          method,
          path,
          status_code: res.statusCode,
          ip,
          user_agent: userAgent,
          request_query: query,
          request_body: body,
          duration_ms: Date.now() - startedAt,
        },
      });
    } catch (error) {
      console.error('[Audit] Failed to write audit log:', error.message);
    }
  });

  next();
}

module.exports = {
  auditLogger,
};
