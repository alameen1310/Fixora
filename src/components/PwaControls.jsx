import { useEffect, useRef, useState } from 'react'
import './PwaControls.css'

export default function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const registrationRef = useRef(null)
  const updateOnControllerChange = useRef(false)

  useEffect(() => {
    function captureInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    function clearInstallPrompt() {
      setInstallPrompt(null)
    }

    function reloadAfterUpdate() {
      if (updateOnControllerChange.current) window.location.reload()
    }

    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', clearInstallPrompt)
    navigator.serviceWorker?.addEventListener('controllerchange', reloadAfterUpdate)

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          registrationRef.current = registration
          setUpdateAvailable(Boolean(registration.waiting && navigator.serviceWorker.controller))

          registration.addEventListener('updatefound', () => {
            const installing = registration.installing
            installing?.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
              }
            })
          })

          registration.update().catch(() => {})
        })
        .catch((error) => console.error('Fixora service worker registration failed.', error))
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', clearInstallPrompt)
      navigator.serviceWorker?.removeEventListener('controllerchange', reloadAfterUpdate)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  function applyUpdate() {
    const waitingWorker = registrationRef.current?.waiting
    if (!waitingWorker) return
    updateOnControllerChange.current = true
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <div className="pwa-controls">
      {installPrompt && (
        <button className="pwa-controls__button" onClick={installApp} type="button">
          Install Fixora
        </button>
      )}
      {updateAvailable && (
        <button className="pwa-controls__button" onClick={applyUpdate} type="button">
          Update app
        </button>
      )}
    </div>
  )
}
