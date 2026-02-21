package site.dgsw.spot.wakeup

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.WorkManager
import dagger.hilt.android.HiltAndroidApp
import site.dgsw.spot.wakeup.scheduler.RefreshWorker
import javax.inject.Inject

@HiltAndroidApp
class SpotApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    // Hilt WorkerFactory 연동 (WorkManagerInitializer 비활성화 필요 → Manifest 참고)
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        // 매시간 기상송 자동 갱신 WorkManager 등록
        RefreshWorker.enqueue(WorkManager.getInstance(this))
    }
}
