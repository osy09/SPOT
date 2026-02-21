package site.dgsw.spot.wakeup.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import site.dgsw.spot.wakeup.data.local.datastore.SettingsDataStore
import site.dgsw.spot.wakeup.data.repository.SongRepository
import site.dgsw.spot.wakeup.scheduler.AlarmScheduler
import site.dgsw.spot.wakeup.service.KeepaliveService
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var repository: SongRepository
    @Inject lateinit var settingsDataStore: SettingsDataStore
    @Inject lateinit var alarmScheduler: AlarmScheduler

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        Log.d(TAG, "Boot/Update received. Restoring service and alarms...")

        // Foreground Service 재시작
        KeepaliveService.start(context)

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                // 네트워크 갱신 실패 시 Room 캐시 사용
                val songs = try {
                    repository.refreshSongs()
                } catch (e: Exception) {
                    Log.w(TAG, "API refresh failed on boot, using cache: ${e.message}")
                    repository.getCachedSongs()
                }
                val playTimes = settingsDataStore.playTimesFlow.first()
                alarmScheduler.scheduleAll(playTimes, songs)
                Log.d(TAG, "Alarms restored: ${songs.size} songs, ${playTimes.size} slots")
            } finally {
                pendingResult.finish()
            }
        }
    }
}
