const crypto = require('crypto');

// 암호화 설정
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * PBKDF2를 사용하여 제공된 시크릿에서 암호화 키 파생
 */
function deriveKey(secret, salt) {
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

/**
 * 민감한 데이터 암호화 (refresh token 등)
 * @param {string} text - 암호화할 평문
 * @returns {string} - 형식의 암호화된 데이터: salt:iv:authTag:encryptedData (모두 hex 인코딩)
 */
function encrypt(text) {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('토큰 암호화를 위해 ENCRYPTION_KEY 환경 변수가 필요합니다');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(process.env.ENCRYPTION_KEY, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 형식: salt:iv:authTag:encryptedData
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 암호화된 데이터 복호화
 * @param {string} encryptedData - 형식의 암호화된 데이터: salt:iv:authTag:encryptedData
 * @returns {string} - 복호화된 평문
 */
function decrypt(encryptedData) {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('토큰 복호화를 위해 ENCRYPTION_KEY 환경 변수가 필요합니다');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('유효하지 않은 암호화된 데이터 형식');
  }

  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];

  const key = deriveKey(process.env.ENCRYPTION_KEY, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
