import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'
import App from './App.jsx'

const SW_RECOVERY_KEY = 'spot_sw_recovery_v2'

async function recoverServiceWorkerOnce(errorLike) {
  const message = String(errorLike?.message || errorLike || '')
  const isBadPrecache = message.includes('bad-precaching-response')
  const alreadyRecovered = sessionStorage.getItem(SW_RECOVERY_KEY) === '1'

  if (!isBadPrecache || alreadyRecovered) {
    return
  }

  sessionStorage.setItem(SW_RECOVERY_KEY, '1')

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))

    if ('caches' in window) {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    }
  } catch (recoveryError) {
    console.error('[PWA] Service worker recovery failed:', recoveryError)
  } finally {
    window.location.reload()
  }
}

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      const shouldRefresh = window.confirm('새 버전이 준비되었습니다. 지금 새로고침할까요?')
      if (shouldRefresh) {
        updateSW(true)
      }
    },
    onRegisterError: async (error) => {
      console.error('[PWA] Service worker registration failed:', error)
      await recoverServiceWorkerOnce(error)
    },
  })

  window.addEventListener('unhandledrejection', (event) => {
    recoverServiceWorkerOnce(event.reason)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
