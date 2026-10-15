import { useEffect, useState } from 'react'
import './install.css'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallApp() {
  const [standalone, setStandalone] = useState(isStandalone)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)')
    const modeChanged = () => setStandalone(isStandalone())
    const ready = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
      setMessage('')
    }
    const installed = () => { setPrompt(null); setStandalone(true) }
    const connectionChanged = () => setOffline(!navigator.onLine)
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('online', connectionChanged)
    window.addEventListener('offline', connectionChanged)
    mode.addEventListener('change', modeChanged)
    return () => {
      window.removeEventListener('beforeinstallprompt', ready)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('online', connectionChanged)
      window.removeEventListener('offline', connectionChanged)
      mode.removeEventListener('change', modeChanged)
    }
  }, [])

  async function install() {
    if (!prompt || busy) return
    const current = prompt
    setBusy(true)
    setMessage('')
    try {
      await current.prompt()
      const choice = await current.userChoice
      setMessage(choice.outcome === 'accepted'
        ? '설치를 진행하고 있어요. 완료되면 조축ON 아이콘을 눌러 주세요.'
        : '나중에 설치해도 괜찮아요. 지금은 브라우저에서 계속 이용할 수 있어요.')
    } catch {
      setMessage('설치 창을 열지 못했어요. 아래 설치 방법을 확인해 주세요.')
    } finally {
      setPrompt(null)
      setBusy(false)
    }
  }

  return <>
    {offline && <p className="connection-notice" role="status"><strong>인터넷 연결이 끊겼어요.</strong><br />다시 연결한 뒤 기록이 저장됐는지 확인해 주세요.</p>}
    {!standalone && <aside className="install-card" aria-labelledby="install-app-title">
      <div className="install-summary">
        <img src="/icons/icon-192.png" width="48" height="48" alt="" />
        <div><h2 id="install-app-title">홈 화면에 조축ON 추가</h2><p>아이콘 한 번으로 우리 팀 기록을 열어요.</p></div>
        {prompt && <button type="button" className="primary-button" onClick={() => void install()} disabled={busy}>{busy ? '설치 창 여는 중…' : '조축ON 설치'}</button>}
      </div>
      {message && <p className="install-message" role="status">{message}</p>}
      <details className="install-guide">
        <summary>아이폰·안드로이드 설치 방법</summary>
        <div className="install-guide-grid">
          <div><h3>아이폰 · Safari</h3><ol><li>Safari에서 조축ON 주소를 열어요.</li><li>공유 메뉴에서 <strong>홈 화면에 추가</strong>를 선택해요.</li><li><strong>웹 앱으로 열기</strong> 옵션이 보이면 켠 뒤 <strong>추가</strong>를 눌러요.</li></ol></div>
          <div><h3>안드로이드 · Chrome</h3><ol><li>Chrome에서 조축ON 주소를 열어요.</li><li>메뉴(⋮)에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해요.</li><li>브라우저 안내에 따라 추가해요.</li></ol></div>
        </div>
        <p>카카오톡에서 열었다면 Safari 또는 Chrome으로 다시 열어 주세요.</p>
        <p>메뉴 이름은 기기마다 다를 수 있어요. 기록을 보거나 저장할 때는 인터넷 연결이 필요해요.</p>
      </details>
    </aside>}
  </>
}
