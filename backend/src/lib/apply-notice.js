const prisma = require('./prisma');

const APPLY_NOTICE_TOKEN_KEY = 'apply_notice_settings';

const DEFAULT_APPLY_NOTICE = Object.freeze({
  wakeupPrimary: '기상송은 먼저 신청된 순서대로 승인됩니다.',
  radioPrimary: '점심방송은 매주 화, 목요일 진행합니다.',
  common: '부적절한 곡은 거절될 수 있습니다.',
});

function normalizeNoticeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeApplyNotice(payload = {}) {
  return {
    wakeupPrimary: normalizeNoticeText(payload.wakeupPrimary, DEFAULT_APPLY_NOTICE.wakeupPrimary),
    radioPrimary: normalizeNoticeText(payload.radioPrimary, DEFAULT_APPLY_NOTICE.radioPrimary),
    common: normalizeNoticeText(payload.common, DEFAULT_APPLY_NOTICE.common),
  };
}

function parseApplyNoticeValue(value) {
  if (typeof value !== 'string') return { ...DEFAULT_APPLY_NOTICE };
  try {
    const parsed = JSON.parse(value);
    return normalizeApplyNotice(parsed);
  } catch {
    return { ...DEFAULT_APPLY_NOTICE };
  }
}

async function getApplyNotice() {
  const token = await prisma.systemToken.findUnique({
    where: { key: APPLY_NOTICE_TOKEN_KEY },
    select: { value: true },
  });

  if (!token) return { ...DEFAULT_APPLY_NOTICE };
  return parseApplyNoticeValue(token.value);
}

async function saveApplyNotice(payload) {
  const normalized = normalizeApplyNotice(payload);
  const value = JSON.stringify(normalized);

  await prisma.systemToken.upsert({
    where: { key: APPLY_NOTICE_TOKEN_KEY },
    update: { value },
    create: { key: APPLY_NOTICE_TOKEN_KEY, value },
  });

  return normalized;
}

module.exports = {
  DEFAULT_APPLY_NOTICE,
  getApplyNotice,
  saveApplyNotice,
};
