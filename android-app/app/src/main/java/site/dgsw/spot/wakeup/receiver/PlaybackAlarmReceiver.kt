package site.dgsw.spot.wakeup.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import site.dgsw.spot.wakeup.scheduler.AlarmScheduler
import site.dgsw.spot.wakeup.ui.main.MainActivity
import site.dgsw.spot.wakeup.ui.playback.PlaybackActivity

class PlaybackAlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PlaybackAlarmReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val videoId = intent.getStringExtra(AlarmScheduler.EXTRA_VIDEO_ID)
        val title = intent.getStringExtra(AlarmScheduler.EXTRA_SONG_TITLE) ?: "기상송"
        val slotIndex = intent.getIntExtra(AlarmScheduler.EXTRA_SLOT_INDEX, 0)

        if (videoId.isNullOrBlank()) {
            Log.e(TAG, "Alarm fired but videoId is null. Slot=$slotIndex")
            return
        }

        Log.d(TAG, "Alarm fired: slot=$slotIndex, videoId=$videoId, title=$title")

        // MainActivity의 onUserLeaveHint가 앱 복귀를 시도하지 않도록 플래그 설정
        MainActivity.expectingPlayback = true

        val playIntent = Intent(context, PlaybackActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(AlarmScheduler.EXTRA_VIDEO_ID, videoId)
            putExtra(AlarmScheduler.EXTRA_SONG_TITLE, title)
        }
        context.startActivity(playIntent)
    }
}
