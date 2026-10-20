import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const staleChunkReloadKey = 'fixora-stale-chunk-reloaded'
let storageUnavailableRecoveryUsed = false
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  try {
    if (sessionStorage.getItem(staleChunkReloadKey)) {
      console.error('Fixora could not load a refreshed app asset. Please reload the page once more.')
      return
    }
    sessionStorage.setItem(staleChunkReloadKey, '1')
  } catch {
    if (storageUnavailableRecoveryUsed) return
    storageUnavailableRecoveryUsed = true
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
