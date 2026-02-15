import { useEffect, useState } from 'react';

const DISMISS_KEY = 'spot_pwa_install_dismissed';

function isStandaloneMode() {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.navigator?.standalone === true) return true;
  return false;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore localStorage failure
    }
  };

  if (isStandalone || dismissed || !deferredPrompt) return null;

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm rounded-xl border backdrop-blur p-3 shadow-lg"
      style={{
        borderColor: 'var(--cu-line)',
        background: 'color-mix(in srgb, var(--cu-panel) 92%, transparent)',
      }}
    >
      <p className="text-sm font-medium">앱으로 설치하면 더 편하게 사용할 수 있어요.</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleInstall}
          className="cu-btn cu-btn-primary flex-1 py-2"
        >
          설치하기
        </button>
        <button
          onClick={handleDismiss}
          className="cu-btn cu-btn-muted py-2"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
