package site.dgsw.spot.wakeup.ui.playback

import android.annotation.SuppressLint
import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.view.WindowCompat
import site.dgsw.spot.wakeup.scheduler.AlarmScheduler
import site.dgsw.spot.wakeup.ui.main.MainActivity

/**
 * YouTube embed URL을 WebView로 전체화면 자동재생.
 *
 * IFrame API(loadDataWithBaseURL) 대신 embed URL을 직접 로드하여
 * YouTube의 임베딩 제한(에러 150/152) 우회.
 *
 * 앱 종료 방지:
 *   - 백 버튼 무시
 *   - 잠금화면 위에서도 표시 (showWhenLocked + turnScreenOn)
 *   - 재생 종료 시 MainActivity로 복귀 (finish)
 */
class PlaybackActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var container: FrameLayout
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 잠금화면 해제 + 화면 켜기
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        val km = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
        km.requestDismissKeyguard(this, null)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 전체화면 몰입 모드
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE

        container = FrameLayout(this)
        setContentView(container)

        val videoId = intent.getStringExtra(AlarmScheduler.EXTRA_VIDEO_ID)
        if (videoId.isNullOrBlank()) {
            finish()
            return
        }

        setupWebView(videoId)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(videoId: String) {
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            settings.apply {
                javaScriptEnabled = true
                mediaPlaybackRequiresUserGesture = false  // autoplay 핵심
                domStorageEnabled = true
                allowContentAccess = true
                builtInZoomControls = false
                displayZoomControls = false
                useWideViewPort = true
                loadWithOverviewMode = true
                // YouTube가 WebView('wv') 환경을 감지해 에러 5를 발생시키는 것을 방지
                userAgentString =
                    "Mozilla/5.0 (Linux; Android 10; Tablet) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/124.0.0.0 Safari/537.36"
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    customView = view
                    customViewCallback = callback
                    container.addView(view)
                    webView.visibility = View.GONE
                }
                override fun onHideCustomView() {
                    customView?.let { container.removeView(it) }
                    customView = null
                    customViewCallback?.onCustomViewHidden()
                    customViewCallback = null
                    webView.visibility = View.VISIBLE
                }
            }
            // 페이지 로드 완료 후 JS 인젝션으로 음소거 해제 + 재생 종료 감지
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    // YouTube 플레이어 초기화 대기 후 인젝션 (4초)
                    view.postDelayed({
                        view.evaluateJavascript(PLAYER_INJECT_JS, null)
                    }, 4000)
                }
            }
            // JS → Android 브릿지 등록
            addJavascriptInterface(AndroidBridge(), "Android")
        }
        container.addView(webView)

        // 서드파티 쿠키 허용: YouTube 플레이어 초기화에 필요
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // YouTube watch 페이지 직접 로드 (임베딩 제한 없음)
        webView.loadUrl("https://www.youtube.com/watch?v=$videoId&autoplay=1&mute=1")
    }

    companion object {
        /**
         * 페이지 로드 후 인젝션:
         * 1) video 요소가 재생 시작되면 음소거 해제
         * 2) ended 이벤트 → Android.onVideoEnded() (즉시 종료)
         * 3) error 이벤트 또는 30초 타임아웃 → Android.onVideoError() (3초 후 종료)
         * 중복 인젝션 방지: window._spotInjected 플래그 사용
         *
         * embed URL 사용 시 YouTube 페이지 크롬이 없으므로 CSS 조작 불필요.
         * 플레이어가 WebView 전체를 자연스럽게 채움.
         */
        private val PLAYER_INJECT_JS = """
            (function() {
              if (window._spotInjected) return;
              window._spotInjected = true;

              var tries = 0;
              var notified = false;

              function notifyEnd() {
                if (!notified) { notified = true; Android.onVideoEnded(); }
              }

              function notifyError() {
                if (!notified) { notified = true; Android.onVideoError(-1); }
              }

              var interval = setInterval(function() {
                tries++;
                var v = document.querySelector('video');
                if (v) {
                  if (v.error) {
                    clearInterval(interval);
                    notifyError();
                    return;
                  }
                  if (!v.paused && !v.ended) {
                    clearInterval(interval);
                    v.muted = false;
                    v.volume = 1;
                    v.currentTime = 0;
                    v.addEventListener('ended', notifyEnd);
                    v.addEventListener('error', notifyError);
                    // 일시정지 감지 → 3초 후 자동 재개 (버퍼링/외부 요인으로 인한 pause 대응)
                    var resumeTimer = null;
                    v.addEventListener('pause', function() {
                      if (v.ended) return;
                      if (resumeTimer) clearTimeout(resumeTimer);
                      resumeTimer = setTimeout(function() {
                        resumeTimer = null;
                        if (v.paused && !v.ended) v.play().catch(function(){});
                      }, 3000);
                    });
                    // ended 이벤트가 발화하지 않을 경우를 대비한 백업 타임아웃
                    // (영상 길이 + 10초 여유)
                    if (isFinite(v.duration) && v.duration > 0) {
                      setTimeout(notifyEnd, (v.duration + 10) * 1000);
                    }
                    return;
                  }
                }
                if (tries >= 60) { clearInterval(interval); notifyError(); }
              }, 500);
            })();
        """.trimIndent()
    }

    /** JavaScript → Kotlin 브릿지 */
    inner class AndroidBridge {
        @JavascriptInterface
        fun onVideoEnded() {
            // 영상 정상 종료 → 즉시 재생창 닫기
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun onVideoError(errorCode: Int) {
            // 재생 오류 → 예비기상송 자동 재생 예약 + 3초 후 재생창 닫기
            MainActivity.playbackFailed = true
            runOnUiThread { webView.postDelayed({ finish() }, 3_000L) }
        }
    }

    // -------------------------------------------------------------------------
    // 시스템 UI / 상단 알림창 차단
    // -------------------------------------------------------------------------

    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    /** 알림창이 열렸다가 닫히면 포커스 복귀 → 몰입 모드 재적용 */
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // -------------------------------------------------------------------------
    // 뒤로가기 / 최근 앱 차단
    // -------------------------------------------------------------------------

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // PlaybackActivity에서는 뒤로가기로 재생창 종료 허용
        finish()
    }

    /** 재생 중 최근 앱 버튼 → PlaybackActivity를 다시 앞으로 가져옴 */
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isFinishing) return
        startActivity(
            Intent(this, PlaybackActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        )
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) webView.onPause()
    }

    override fun onDestroy() {
        if (!::webView.isInitialized) { super.onDestroy(); return }
        webView.apply {
            stopLoading()
            loadUrl("about:blank")
            clearHistory()
            removeJavascriptInterface("Android")
            destroy()
        }
        super.onDestroy()
    }
}
