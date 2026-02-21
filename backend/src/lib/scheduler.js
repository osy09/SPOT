const cron = require('node-cron');
const prisma = require('./prisma');
const {
  KST_TIMEZONE,
  getKstDate,
  getKstDayRange,
  addDaysToKstDate,
  kstDateToUtcDate,
} = require('./kst-time');

// 세션 정리는 PrismaSessionStore의 1시간 interval에서 처리

/**
 * 만료된 곡 정리
 * - 오늘 이전 날짜의 APPROVED 상태 기상송 삭제
 * - 7일 이전에 거절된 곡 삭제
 */
async function cleanupExpiredSongs(now = new Date()) {
  const todayKstDate = getKstDate(now);
  const { start: todayStartUtc } = getKstDayRange(todayKstDate);
  const rejectedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [deletedApproved, deletedRejected] = await prisma.$transaction([
    prisma.song.deleteMany({
      where: {
        status: 'APPROVED',
        play_date: { lt: todayStartUtc },
      },
    }),
    prisma.song.deleteMany({
      where: {
        status: 'REJECTED',
        OR: [
          { rejected_at: { lt: rejectedCutoff } },
          { rejected_at: null, created_at: { lt: rejectedCutoff } },
        ],
      },
    }),
  ]);

  if (deletedApproved.count > 0 || deletedRejected.count > 0) {
    console.log(
      `[스케줄러] 만료 곡 정리 (기준일: ${todayStartUtc.toISOString()}) — ` +
      `APPROVED ${deletedApproved.count}개, REJECTED ${deletedRejected.count}개 삭제됨`
    );
  }
}

/**
 * 크론 작업 시작
 */
function startScheduler() {
  // 매일 08:00 KST에 실행 - 기상송 자동 승인
  cron.schedule('0 8 * * *', async () => {
    try {
      const todayKst = getKstDate();
      const targetKstDate = addDaysToKstDate(todayKst, 3);

      // 주말(토·일)에는 기상송을 승인하지 않음
      const targetUtcDate = new Date(Date.UTC(targetKstDate.year, targetKstDate.month - 1, targetKstDate.day));
      const dayOfWeek = targetUtcDate.getUTCDay(); // 0=일, 6=토
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return;
      }

      const playDate = kstDateToUtcDate(targetKstDate, 0, 0, 0, 0);
      const targetEndDate = addDaysToKstDate(targetKstDate, 1);
      const targetEndUtc = kstDateToUtcDate(targetEndDate, 0, 0, 0, 0);

      const alreadyApprovedCount = await prisma.song.count({
        where: {
          type: 'WAKEUP',
          status: { in: ['APPROVED', 'PLAYED'] },
          play_date: { gte: playDate, lt: targetEndUtc },
        },
      });

      const remainingSlots = Math.max(0, 2 - alreadyApprovedCount);
      if (remainingSlots === 0) {
        return;
      }

      const pendingSongs = await prisma.song.findMany({
        where: { type: 'WAKEUP', status: 'PENDING' },
        orderBy: { created_at: 'asc' },
        take: remainingSlots,
        select: { id: true },
      });

      if (pendingSongs.length > 0) {
        await prisma.song.updateMany({
          where: { id: { in: pendingSongs.map((s) => s.id) } },
          data: { status: 'APPROVED', play_date: playDate },
        });
        console.log(`[스케줄러] ${targetKstDate.year}-${String(targetKstDate.month).padStart(2,'0')}-${String(targetKstDate.day).padStart(2,'0')} 기상송 ${pendingSongs.length}곡 자동 승인됨`);
      }
    } catch (err) {
      console.error('[스케줄러] 오류:', err);
    }
  }, { timezone: KST_TIMEZONE });

  // 매일 08:00 KST에 실행 - 만료된 곡 정리
  cron.schedule('0 8 * * *', async () => {
    try {
      await cleanupExpiredSongs();
    } catch (err) {
      console.error('[스케줄러] 곡 정리 오류:', err);
    }
  }, { timezone: KST_TIMEZONE });

  // 시작 시 한 번 실행하여 즉시 일관성 확보
  cleanupExpiredSongs().catch((err) => {
    console.error('[스케줄러] 시작 시 곡 정리 오류:', err);
  });

  console.log('[스케줄러] 크론 작업이 성공적으로 시작되었습니다');
}

module.exports = { startScheduler };
