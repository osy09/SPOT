/**
 * Migration Script: Encrypt Existing YouTube Refresh Token
 *
 * This script encrypts the existing YouTube refresh token in the database
 * if it's stored in plaintext format.
 *
 * Usage:
 *   node migrate-youtube-token.js
 *
 * Environment Variables Required:
 *   - DATABASE_URL
 *   - ENCRYPTION_KEY
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('./src/lib/crypto');

const prisma = new PrismaClient();

async function migrateYoutubeToken() {
  try {
    console.log('[Migration] Starting YouTube token encryption migration...');

    // Check if ENCRYPTION_KEY is set
    if (!process.env.ENCRYPTION_KEY) {
      console.error('[Migration] ERROR: ENCRYPTION_KEY environment variable is not set');
      console.error('[Migration] Please set ENCRYPTION_KEY before running this migration');
      process.exit(1);
    }

    // Find the YouTube refresh token
    const tokenRecord = await prisma.systemToken.findUnique({
      where: { key: 'youtube_refresh_token' },
    });

    if (!tokenRecord) {
      console.log('[Migration] No YouTube refresh token found in database');
      console.log('[Migration] Nothing to migrate');
      return;
    }

    // Check if token is already encrypted
    // Encrypted tokens have the format: salt:iv:authTag:encryptedData
    // So they will contain colons (':')
    if (tokenRecord.value.includes(':')) {
      console.log('[Migration] Token appears to be already encrypted');
      console.log('[Migration] No migration needed');
      return;
    }

    console.log('[Migration] Found plaintext token, encrypting...');

    // Encrypt the token
    const encryptedToken = encrypt(tokenRecord.value);

    // Update the database
    await prisma.systemToken.update({
      where: { key: 'youtube_refresh_token' },
      data: { value: encryptedToken },
    });

    console.log('[Migration] ✓ Token encrypted successfully');
    console.log('[Migration] Migration complete');
  } catch (error) {
    console.error('[Migration] ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateYoutubeToken();
