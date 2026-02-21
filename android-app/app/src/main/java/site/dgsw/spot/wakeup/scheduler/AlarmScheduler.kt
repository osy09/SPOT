package site.dgsw.spot.wakeup.scheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import site.dgsw.spot.wakeup.domain.model.Song
import site.dgsw.spot.wakeup.receiver.PlaybackAlarmReceiver
import site.dgsw.spot.wakeup.util.TimeUtils
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AlarmScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private const val TAG = "AlarmScheduler"
        const val EXTRA_VIDEO_ID = "extra_video_id"
        const val EXTRA_SONG_TITLE = "extra_song_title"
        const val EXTRA_SLOT_INDEX = "extra_slot_index"
        private const val ALARM_BASE_CODE = 2000
        const val MAX_SLOTS = 5
    }

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    /**
     * 재생 시간 목록과 기상송 목록을 AlarmManager에 등록.
     * - 슬롯 수 <= 기상송 수: 순서대로 1:1 배정
     * - 슬롯 수 > 기상송 수: 마지막 곡 반복
     */
    fun scheduleAll(playTimes: List<String>, songs: List<Song>) {
        cancelAll()

        if (songs.isEmpty() || playTimes.isEmpty()) {
            Log.w(TAG, "scheduleAll skipped: songs=${songs.size}, times=${playTimes.size}")
            return
        }

        playTimes.forEachIndexed { slotIndex, timeStr ->
            val song = if (slotIndex < songs.size) songs[slotIndex] else songs.last()
            val triggerMs = TimeUtils.todayMillisFor(timeStr)
            scheduleOne(slotIndex, song, triggerMs)
            Log.d(TAG, "Slot $slotIndex → '${song.title}' at $timeStr (${triggerMs}ms)")
        }
    }

    private fun scheduleOne(slotIndex: Int, song: Song, triggerMs: Long) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!alarmManager.canScheduleExactAlarms()) {
                Log.e(TAG, "SCHEDULE_EXACT_ALARM 권한 없음. 알람 등록 불가.")
                return
            }
        }

        val intent = Intent(context, PlaybackAlarmReceiver::class.java).apply {
            putExtra(EXTRA_VIDEO_ID, song.videoId)
            putExtra(EXTRA_SONG_TITLE, song.title)
            putExtra(EXTRA_SLOT_INDEX, slotIndex)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            ALARM_BASE_CODE + slotIndex,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi)
    }

    /** 등록된 모든 알람(슬롯 0~MAX_SLOTS-1) 취소 */
    fun cancelAll() {
        for (i in 0 until MAX_SLOTS) {
            val intent = Intent(context, PlaybackAlarmReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                context,
                ALARM_BASE_CODE + i,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            ) ?: continue
            alarmManager.cancel(pi)
            pi.cancel()
        }
        Log.d(TAG, "All alarms cancelled.")
    }
}
