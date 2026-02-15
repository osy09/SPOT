const { PrismaClient } = require('@prisma/client');

function resolveTursoUrl() {
  if (typeof process.env.TURSO_DATABASE_URL === 'string' && process.env.TURSO_DATABASE_URL.trim()) {
    return process.env.TURSO_DATABASE_URL.trim();
  }

  if (typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.startsWith('libsql')) {
    return process.env.DATABASE_URL.trim();
  }

  throw new Error('[CRITICAL] TURSO_DATABASE_URL (or libsql DATABASE_URL) is required.');
}

function createPrismaClient() {
  const tursoUrl = resolveTursoUrl();
  const { PrismaLibSQL } = require('@prisma/adapter-libsql');
  const adapter = new PrismaLibSQL({
    url: tursoUrl,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

module.exports = prisma;
