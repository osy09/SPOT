require('dotenv').config();

// 모든 날짜 연산을 위해 타임존을 Asia/Seoul로 설정
process.env.TZ = 'Asia/Seoul';

const { startScheduler } = require('./lib/scheduler');

// 필수 환경 변수 검증
if (!process.env.DATABASE_URL && !process.env.TURSO_DATABASE_URL) {
  console.error('[스케줄러] DATABASE_URL 또는 TURSO_DATABASE_URL 환경 변수가 필요합니다');
  process.exit(1);
}

startScheduler();

console.log('[스케줄러] 스케줄러 전용 프로세스 시작됨');
console.log(`[스케줄러] 타임존: ${process.env.TZ}`);

// 종료 시 정리
process.on('SIGTERM', () => {
  console.log('[스케줄러] SIGTERM 수신 - 종료 중...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[스케줄러] SIGINT 수신 - 종료 중...');
  process.exit(0);
});
