let registrationRequested = false

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !window.isSecureContext
      || !('serviceWorker' in navigator) || registrationRequested) return
  registrationRequested = true

  const register = () => {
    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).catch(() => {
      // Installation support must never interrupt login or an in-progress draft.
      console.warn('조축ON 설치 지원을 준비하지 못했습니다. 웹 화면은 계속 사용할 수 있습니다.')
    })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
