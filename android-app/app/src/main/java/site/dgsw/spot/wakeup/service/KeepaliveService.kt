package site.dgsw.spot.wakeup.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import site.dgsw.spot.wakeup.R
import site.dgsw.spot.wakeup.ui.main.MainActivity

/**
 * 앱 프로세스를 살아있게 유지하는 Foreground Service.
 * 상태표시줄 알림을 표시하고, Android OS의 프로세스 킬을 방지한다.
 * START_STICKY: 강제 종료 시 OS가 자동으로 재시작.
 */
class KeepaliveService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "spot_keepalive"

        fun start(context: Context) {
            val intent = Intent(context, KeepaliveService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, KeepaliveService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: 서비스가 종료되면 OS가 자동 재시작 (Intent는 null로 전달)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,  // 소리 없음, 진동 없음
        ).apply {
            description = "SPOT 기상송 자동 방송 서비스"
            setShowBadge(false)
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val tapPi = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(tapPi)
            .setOngoing(true)       // 사용자가 스와이프로 제거 불가
            .setAutoCancel(false)
            .build()
    }
}
