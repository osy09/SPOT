const session = require('express-session');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CHECK_PERIOD_MS = 60 * 60 * 1000;

function resolveExpiresAt(sess) {
  const cookie = sess?.cookie || {};

  if (cookie.expires) {
    const expiresAt = new Date(cookie.expires);
    if (!Number.isNaN(expiresAt.getTime())) return expiresAt;
  }

  if (typeof cookie.maxAge === 'number' && Number.isFinite(cookie.maxAge)) {
    return new Date(Date.now() + cookie.maxAge);
  }

  return new Date(Date.now() + DEFAULT_TTL_MS);
}

class PrismaSessionStore extends session.Store {
  constructor(prisma, options = {}) {
    super();
    this.prisma = prisma;
    this.checkPeriodMs = Number.isInteger(options.checkPeriodMs)
      ? options.checkPeriodMs
      : DEFAULT_CHECK_PERIOD_MS;

    if (this.checkPeriodMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.pruneExpired().catch((error) => {
          console.error('[SessionStore] Failed to prune expired sessions:', error.message);
        });
      }, this.checkPeriodMs);

      if (typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    }

    this.pruneExpired().catch((error) => {
      console.error('[SessionStore] Initial prune failed:', error.message);
    });
  }

  async pruneExpired() {
    await this.prisma.session.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
  }

  get(sid, callback = () => {}) {
    this.prisma.session.findUnique({ where: { sid } })
      .then(async (record) => {
        if (!record) {
          callback(null, null);
          return;
        }

        if (record.expires_at < new Date()) {
          await this.prisma.session.delete({ where: { sid } }).catch(() => {});
          callback(null, null);
          return;
        }

        try {
          callback(null, JSON.parse(record.data));
        } catch {
          await this.prisma.session.delete({ where: { sid } }).catch(() => {});
          callback(null, null);
        }
      })
      .catch((error) => callback(error));
  }

  set(sid, sess, callback = () => {}) {
    const data = JSON.stringify(sess);
    const expires_at = resolveExpiresAt(sess);

    this.prisma.session.upsert({
      where: { sid },
      create: { sid, data, expires_at },
      update: { data, expires_at },
    })
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sess, callback = () => {}) {
    const data = JSON.stringify(sess);
    const expires_at = resolveExpiresAt(sess);

    this.prisma.session.update({
      where: { sid },
      data: { data, expires_at },
    })
      .then(() => callback(null))
      .catch((error) => {
        if (error?.code === 'P2025') {
          callback(null);
          return;
        }
        callback(error);
      });
  }

  destroy(sid, callback = () => {}) {
    this.prisma.session.delete({ where: { sid } })
      .then(() => callback(null))
      .catch((error) => {
        if (error?.code === 'P2025') {
          callback(null);
          return;
        }
        callback(error);
      });
  }

  length(callback = () => {}) {
    this.prisma.session.count({
      where: { expires_at: { gte: new Date() } },
    })
      .then((count) => callback(null, count))
      .catch((error) => callback(error));
  }

  clear(callback = () => {}) {
    this.prisma.session.deleteMany({})
      .then(() => callback(null))
      .catch((error) => callback(error));
  }
}

module.exports = {
  PrismaSessionStore,
};
