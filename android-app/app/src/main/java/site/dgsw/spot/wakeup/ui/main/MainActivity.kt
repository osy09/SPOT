package site.dgsw.spot.wakeup.ui.main

import android.Manifest
import android.app.AlarmManager
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.core.view.WindowCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import site.dgsw.spot.wakeup.R
import site.dgsw.spot.wakeup.service.KeepaliveService
import site.dgsw.spot.wakeup.ui.settings.SettingsScreen
import kotlin.system.exitProcess

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        /** PlaybackAlarmReceiver가 PlaybackActivity를 시작하기 전에 true로 설정 */
        @Volatile var expectingPlayback = false
        /** YouTube 재생 오류 시 true → MainActivity 복귀 후 예비기상송 자동 재생 */
        @Volatile var playbackFailed = false
    }

    private var isExiting = false

    /**
     * 권한 설정 화면(배터리 최적화, 정확한 알람)으로 이동 중이면 true.
     * onUserLeaveHint에서 앱 복귀 동작을 막기 위해 사용.
     */
    private var isNavigatingToSettings = false

    private var hasAskedNotifications = false
    private lateinit var notifPermLauncher: ActivityResultLauncher<String>
    private lateinit var batteryOptLauncher: ActivityResultLauncher<Intent>

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        notifPermLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
        batteryOptLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            isNavigatingToSettings = false
        }

        KeepaliveService.start(this)
        requestMissingPermissions()

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    SpotNavGraph(onAdminExit = ::performAdminExit)
                }
            }
        }

        // Window가 완전히 생성된 후 호출되도록 보장하기 위해
        window.decorView.post {
            hideSystemBars()
        }
    }

    override fun onResume() {
        super.onResume()
        expectingPlayback = false
        isNavigatingToSettings = false
        hideSystemBars()
        requestMissingPermissions()
    }

    // -------------------------------------------------------------------------
    // 상단 알림창 / 빠른 설정 차단 (풀 몰입 모드)
    // -------------------------------------------------------------------------

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                // 사용자가 스와이프해도 잠깐 보였다가 자동으로 다시 숨김
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }
    }

    /** 알림창/빠른설정이 열렸다가 닫히면 포커스 복귀 → 즉시 몰입 모드 재적용 */
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // -------------------------------------------------------------------------
    // 권한 요청
    // -------------------------------------------------------------------------

    private fun requestMissingPermissions() {
        // 1. 알림 권한 (Android 13+) — 런타임 다이얼로그
        if (!hasAskedNotifications &&
            Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            hasAskedNotifications = true
            notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        // 2. 배터리 최적화 제외 — 설정 화면 이동
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            isNavigatingToSettings = true
            batteryOptLauncher.launch(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
            return
        }

        // 3. 정확한 알람 권한 (Android 12+) — 설정 화면 이동
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = getSystemService(ALARM_SERVICE) as AlarmManager
            if (am.canScheduleExactAlarms() == false) {
                isNavigatingToSettings = true
                startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))
            }
        }
    }

    // -------------------------------------------------------------------------
    // 최근 앱 버튼 차단
    // -------------------------------------------------------------------------

    /**
     * 사용자가 홈/최근 앱 버튼을 눌렀을 때 앱을 다시 전면으로 가져온다.
     * 권한 설정 화면 이동 중, PlaybackActivity 전환 중, 종료 시퀀스 중에는 무시한다.
     */
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isExiting || isNavigatingToSettings || expectingPlayback) return
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        )
    }

    // -------------------------------------------------------------------------
    // 뒤로가기 완전 차단
    // -------------------------------------------------------------------------

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { /* 완전 차단 */ }

    // -------------------------------------------------------------------------
    // 관리자 종료 (10회 탭 + 비밀번호 1234)
    // -------------------------------------------------------------------------

    private fun performAdminExit() {
        isExiting = true
        KeepaliveService.stop(this)
        finishAffinity()
        exitProcess(0)
    }
}

@Composable
private fun SpotNavGraph(onAdminExit: () -> Unit) {
    val context = LocalContext.current
    val navController = rememberNavController()

    // MediaPlayer를 SpotNavGraph(Activity setContent 직하) 수준에서 관리.
    // MainScreen은 Settings 이동 시 컴포지션에서 제거되므로 이곳에서 관리해야
    // 설정 화면 이동 중에도 수동방송 음원이 계속 재생된다.
    var activePlayer by remember { mutableStateOf<MediaPlayer?>(null) }
    var isBroadcastPlaying by remember { mutableStateOf(false) }

    fun releasePlayer() {
        activePlayer?.runCatching { if (isPlaying) stop(); release() }
        activePlayer = null
        isBroadcastPlaying = false
    }

    fun playBroadcast(resId: Int) {
        releasePlayer()
        isBroadcastPlaying = true
        activePlayer = MediaPlayer.create(context, resId)?.apply {
            setOnCompletionListener { mp ->
                mp.release()
                activePlayer = null
                isBroadcastPlaying = false
            }
            start()
        }
    }

    fun stopBroadcast() {
        releasePlayer()
    }

    DisposableEffect(Unit) {
        onDispose { activePlayer?.runCatching { if (isPlaying) stop(); release() } }
    }

    // YouTube 재생 시작(PlaybackActivity 전환) 감지 → 수동방송 음원 중단
    // YouTube 재생 실패(playbackFailed) 감지 → 예비기상송 자동 재생
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_PAUSE && MainActivity.expectingPlayback) {
                releasePlayer()
            }
            if (event == Lifecycle.Event.ON_RESUME && MainActivity.playbackFailed) {
                MainActivity.playbackFailed = false
                playBroadcast(R.raw.spare_alarm)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    NavHost(navController = navController, startDestination = "main") {
        composable("main") {
            MainScreen(
                onNavigateToSettings = { navController.navigate("settings") },
                onAdminExit = onAdminExit,
                isBroadcastPlaying = isBroadcastPlaying,
                onPlayBroadcast = ::playBroadcast,
                onStopBroadcast = ::stopBroadcast,
            )
        }
        composable("settings") {
            SettingsScreen(onNavigateBack = { navController.popBackStack() })
        }
    }
}
