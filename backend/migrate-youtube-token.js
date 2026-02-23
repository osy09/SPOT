/**
 * 마이그레이션 스크립트: 기존 YouTube Refresh Token 암호화
 *
 * 데이터베이스에 평문으로 저장된 YouTube refresh token을 암호화합니다.
 *
 * 사용법:
 *   node migrate-youtube-token.js
 *
 * 필수 환경 변수:
 *   - DATABASE_URL
 *   - ENCRYPTION_KEY
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('./src/lib/crypto');

const prisma = new PrismaClient();

async function migrateYoutubeToken() {
  try {
    console.log('[Migration] YouTube 토큰 암호화 마이그레이션 시작...');

    // ENCRYPTION_KEY 설정 여부 확인
    if (!process.env.ENCRYPTION_KEY) {
      console.error('[Migration] ERROR: ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다');
      console.error('[Migration] 마이그레이션 실행 전 ENCRYPTION_KEY를 설정하세요');
      process.exit(1);
    }

    // YouTube refresh token 조회
    const tokenRecord = await prisma.systemToken.findUnique({
      where: { key: 'youtube_refresh_token' },
    });

    if (!tokenRecord) {
      console.log('[Migration] 데이터베이스에서 YouTube refresh token을 찾을 수 없습니다');
      console.log('[Migration] 마이그레이션할 항목 없음');
      return;
    }

    // 이미 암호화된 토큰인지 확인
    // 암호화된 토큰의 형식: salt:iv:authTag:encryptedData
    // 콜론(':')이 포함되어 있으면 이미 암호화된 상태
    if (tokenRecord.value.includes(':')) {
      console.log('[Migration] 토큰이 이미 암호화된 것으로 보입니다');
      console.log('[Migration] 마이그레이션 불필요');
      return;
    }

    console.log('[Migration] 평문 토큰을 발견했습니다. 암호화 중...');

    // 토큰 암호화
    const encryptedToken = encrypt(tokenRecord.value);

    // 데이터베이스 업데이트
    await prisma.systemToken.update({
      where: { key: 'youtube_refresh_token' },
      data: { value: encryptedToken },
    });

    console.log('[Migration] ✓ 토큰 암호화 완료');
    console.log('[Migration] 마이그레이션 완료');
  } catch (error) {
    console.error('[Migration] ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 마이그레이션 실행
migrateYoutubeToken();
