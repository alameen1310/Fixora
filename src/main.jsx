import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const staleChunkReloadKey = 'fixora-stale-chunk-reloaded-at'
const staleChunkRetryParam = '__fixora_chunk_retry'
const STALE_CHUNK_RETRY_WINDOW_MS = 12_000
const staleChunkPageUrl = new URL(window.location.href)
const staleChunkPageRetry = staleChunkPageUrl.searchParams.get(staleChunkRetryParam)
window.addEventListener('load', () => {
  window.setTimeout(() => {
    try { sessionStorage.removeItem(staleChunkReloadKey) } catch { /* storage can be unavailable in private contexts */ }
    if (staleChunkPageRetry) {
      const current = new URL(window.location.href)
      if (current.searchParams.get(staleChunkRetryParam) === staleChunkPageRetry) {
        current.searchParams.delete(staleChunkRetryParam)
        window.history.replaceState(window.history.state, '', current)
      }
    }
  }, STALE_CHUNK_RETRY_WINDOW_MS)
}, { once: true })

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const now = Date.now()
  try {
    const lastRecoveryAt = Number(sessionStorage.getItem(staleChunkReloadKey))
    if (lastRecoveryAt && now - lastRecoveryAt < STALE_CHUNK_RETRY_WINDOW_MS) return
    sessionStorage.setItem(staleChunkReloadKey, String(now))
  } catch {
    const lastRecoveryAt = Number(staleChunkPageUrl.searchParams.get(staleChunkRetryParam))
    if (lastRecoveryAt && now - lastRecoveryAt < STALE_CHUNK_RETRY_WINDOW_MS) return
    staleChunkPageUrl.searchParams.set(staleChunkRetryParam, String(now))
    window.history.replaceState(window.history.state, '', staleChunkPageUrl)
  }
  window.location.reload()
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let reloadingForWorker = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForWorker) return
    reloadingForWorker = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error('Fixora service worker registration failed:', error)
      })
  }, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
