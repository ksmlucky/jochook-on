import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LeaveGuardProvider } from './app/LeaveGuard'
import { registerServiceWorker } from './app/registerServiceWorker'
import './styles.css'
import './app/layout.css'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LeaveGuardProvider><App /></LeaveGuardProvider>
  </StrictMode>,
)
