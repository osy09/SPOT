const cron = require('node-cron');
const prisma = require('./prisma');
const {
  KST_TIMEZONE,
  getKstDate,
  getKstDayRange,
  addDaysToKstDate,
  kstDateToUtcDate,
} = require('./kst-time');

async function cleanupExpiredSongs(now = new Date()) {
  const todayKstDate = getKstDate(now);
  const { start: todayStartUtc } = getKstDayRange(todayKstDate);
  const rejectedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
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
}

function startScheduler() {
  // Run every day at 08:00 KST
  cron.schedule('0 8 * * *', async () => {
    try {
      const todayKst = getKstDate();
      const targetKstDate = addDaysToKstDate(todayKst, 3);
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
      });

      for (const song of pendingSongs) {
        await prisma.song.update({
          where: { id: song.id },
          data: { status: 'APPROVED', play_date: playDate },
        });
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
  }, { timezone: KST_TIMEZONE });

  // Run every hour at minute 10 (KST)
  cron.schedule('10 * * * *', async () => {
    try {
      await cleanupExpiredSongs();
    } catch (err) {
      console.error('[Scheduler] Cleanup Error:', err);
    }
  }, { timezone: KST_TIMEZONE });

  // Run once on startup for immediate consistency
  cleanupExpiredSongs().catch((err) => {
    console.error('[Scheduler] Startup Cleanup Error:', err);
  });
}

module.exports = { startScheduler };
