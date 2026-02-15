const KST_TIMEZONE = 'Asia/Seoul';
const KST_UTC_OFFSET_HOURS = 9;

const kstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function getKstParts(date = new Date()) {
  const parts = kstFormatter.formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value);

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  };
}

function getKstDate(date = new Date()) {
  const { year, month, day } = getKstParts(date);
  return { year, month, day };
}

function addDaysToKstDate(kstDate, days) {
  const normalized = new Date(Date.UTC(kstDate.year, kstDate.month - 1, kstDate.day + days));
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
  };
}

function kstDateToUtcDate(kstDate, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(
    Date.UTC(
      kstDate.year,
      kstDate.month - 1,
      kstDate.day,
      hour - KST_UTC_OFFSET_HOURS,
      minute,
      second,
      millisecond
    )
  );
}

function getKstDayRange(kstDate) {
  const start = kstDateToUtcDate(kstDate, 0, 0, 0, 0);
  const nextDay = addDaysToKstDate(kstDate, 1);
  const end = kstDateToUtcDate(nextDay, 0, 0, 0, 0);
  return { start, end };
}

function getWakeupDisplayDateKst(date = new Date()) {
  const parts = getKstParts(date);
  const today = { year: parts.year, month: parts.month, day: parts.day };

  if (parts.hour >= 8) {
    return addDaysToKstDate(today, 1);
  }

  return today;
}

function formatKstDate(kstDate) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${kstDate.year}-${pad(kstDate.month)}-${pad(kstDate.day)}`;
}

function parseKstDateInput(dateInput) {
  if (typeof dateInput !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!match) return null;

  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  if (
    Number.isNaN(parsed.year) ||
    Number.isNaN(parsed.month) ||
    Number.isNaN(parsed.day) ||
    parsed.month < 1 ||
    parsed.month > 12 ||
    parsed.day < 1 ||
    parsed.day > 31
  ) {
    return null;
  }

  // Validate impossible dates like 2026-02-31
  const normalized = addDaysToKstDate(parsed, 0);
  if (
    normalized.year !== parsed.year ||
    normalized.month !== parsed.month ||
    normalized.day !== parsed.day
  ) {
    return null;
  }

  return parsed;
}

module.exports = {
  KST_TIMEZONE,
  getKstParts,
  getKstDate,
  addDaysToKstDate,
  kstDateToUtcDate,
  getKstDayRange,
  getWakeupDisplayDateKst,
  formatKstDate,
  parseKstDateInput,
};
