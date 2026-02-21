package site.dgsw.spot.wakeup.scheduler

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.*
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import site.dgsw.spot.wakeup.data.local.datastore.SettingsDataStore
import site.dgsw.spot.wakeup.data.repository.SongRepository
import java.util.concurrent.TimeUnit

@HiltWorker
class RefreshWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val repository: SongRepository,
    private val settingsDataStore: SettingsDataStore,
    private val alarmScheduler: AlarmScheduler,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "RefreshWorker"
        const val WORK_NAME = "spot_hourly_refresh"

        fun enqueue(workManager: WorkManager) {
            val request = PeriodicWorkRequestBuilder<RefreshWorker>(30, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.LINEAR, 15, TimeUnit.MINUTES)
                .build()

            workManager.enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
            Log.d(TAG, "Hourly refresh work enqueued.")
        }
    }

    override suspend fun doWork(): Result {
        return try {
            Log.d(TAG, "Refreshing songs...")
            val songs = repository.refreshSongs()
            val playTimes = settingsDataStore.playTimesFlow.first()
            alarmScheduler.scheduleAll(playTimes, songs)
            Log.d(TAG, "Refresh done: ${songs.size} songs, alarms rescheduled.")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Refresh failed: ${e.message}", e)
            // 갱신 실패 시 캐시된 기상송으로 알람 재등록
            try {
                val cached = repository.getCachedSongs()
                val playTimes = settingsDataStore.playTimesFlow.first()
                alarmScheduler.scheduleAll(playTimes, cached)
                Log.d(TAG, "Fallback to cache: ${cached.size} songs rescheduled.")
            } catch (ex: Exception) {
                Log.e(TAG, "Cache fallback failed: ${ex.message}", ex)
            }
            Result.retry()
        }
    }
}
