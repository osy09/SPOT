const cron = require('node-cron');
const prisma = require('./prisma');
const {
  KST_TIMEZONE,
  getKstDate,
  addDaysToKstDate,
  kstDateToUtcDate,
  formatKstDate,
} = require('./kst-time');

function startScheduler() {
  // Run every day at 08:00 KST
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Running daily wake-up song auto-approval at 08:00 KST...');
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
        console.log(
          `[Scheduler] Skipped auto-approval for ${formatKstDate(targetKstDate)} (KST): already ${alreadyApprovedCount} songs approved.`
        );
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
        console.log(`[Scheduler] Approved song: ${song.title} for ${formatKstDate(targetKstDate)} (KST)`);
      }

      if (pendingSongs.length === 0) {
        console.log(
          `[Scheduler] No pending wake-up songs to approve. (${formatKstDate(targetKstDate)} KST slots left: ${remainingSlots})`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
  }, { timezone: KST_TIMEZONE });

  console.log('[Scheduler] Wake-up song auto-approval scheduled (daily at 08:00 KST).');
}

module.exports = { startScheduler };
