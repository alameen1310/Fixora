import { useEffect, useRef, useState } from 'react'
import { ArrowClockwise, DownloadSimple, X } from '@phosphor-icons/react'
import OverlayPortal from './OverlayPortal.jsx'
import './PwaControls.css'

const DISMISSED_AT_KEY = 'fixora-install-prompt-dismissed-at'
const DISMISSAL_COOLDOWN = 7 * 24 * 60 * 60 * 1000

function isRunningInstalled() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone,
  )
}

function getIOSInstallGuide() {
  const userAgent = window.navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)

  return isIOS ? {
    title: 'Add Fixora to your Home Screen',
    description: 'Keep Fixora close by adding it to your Home Screen.',
    steps: [
      'Open this page in Safari.',
      'Tap the Share button.',
      'Choose “Add to Home Screen”, then tap Add.',
    ],
  } : null
}

function hasRecentlyDismissed() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY))
    return dismissedAt > 0 && Date.now() - dismissedAt < DISMISSAL_COOLDOWN
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
  } catch {
    // The current page remains protected by its in-memory state.
  }
}

export default function PwaControls() {
  const dialogRef = useRef(null)
  const promptEventRef = useRef(null)
  const dismissedRef = useRef(false)
  const [guide, setGuide] = useState(null)
  const [fallbackError, setFallbackError] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [installAvailable, setInstallAvailable] = useState(false)
  const [installed, setInstalled] = useState(() => isRunningInstalled())
  const [updateWorker, setUpdateWorker] = useState(null)
  const [installing, setInstalling] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    const iosGuide = getIOSInstallGuide()
    if (!installed && !isRunningInstalled() && !hasRecentlyDismissed() && iosGuide) {
      setGuide(iosGuide)
      setPromptOpen(true)
    }

    function openInstallPrompt() {
      if (dismissedRef.current || installed || isRunningInstalled() || hasRecentlyDismissed()) return
      setGuide(null)
      setPromptOpen(true)
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      promptEventRef.current = event
      setInstallAvailable(true)
      openInstallPrompt()
    }

    function handleInstalled() {
      setInstalled(true)
      setPromptOpen(false)
      promptEventRef.current = null
      setInstallAvailable(false)
      try {
        window.localStorage.removeItem(DISMISSED_AT_KEY)
      } catch {
        // Installation state is still updated for this running page.
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    let registration
    let stopWatching
    let cancelled = false
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      const watchRegistration = (currentRegistration) => {
        if (cancelled || !currentRegistration) return
        registration = currentRegistration
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateWorker(registration.waiting)
        const watchInstallingWorker = () => {
          const installingWorker = registration.installing
          installingWorker?.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateWorker(installingWorker)
            }
          })
        }
        registration.addEventListener('updatefound', watchInstallingWorker)
        if (registration.installing) watchInstallingWorker()
        const checkForUpdate = () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {})
        }
        checkForUpdate()
        const updateInterval = window.setInterval(checkForUpdate, 5 * 60 * 1000)
        document.addEventListener('visibilitychange', checkForUpdate)
        return () => {
          window.clearInterval(updateInterval)
          document.removeEventListener('visibilitychange', checkForUpdate)
          registration?.removeEventListener('updatefound', watchInstallingWorker)
        }
      }

      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: 'none',
        })
        .then((currentRegistration) => {
          if (cancelled) return
          stopWatching = watchRegistration(currentRegistration)
        })
        .catch((error) => {
          console.error('Fixora service worker registration failed:', error)
        })
    }

    return () => {
      cancelled = true
      stopWatching?.()
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [installed])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (promptOpen && !dialog.open) dialog.showModal()
    if (!promptOpen && dialog.open) dialog.close()
  }, [promptOpen])

  async function install() {
    const installEvent = promptEventRef.current
    if (!installEvent || installing) return
    setInstalling(true)
    promptEventRef.current = null
    setInstallAvailable(false)
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice?.outcome === 'accepted') {
        setInstalled(true)
        setPromptOpen(false)
      } else {
        markDismissed()
        setPromptOpen(false)
      }
    } catch {
      setFallbackError(true)
    } finally {
      setInstalling(false)
    }
  }

  function dismissPrompt() {
    dismissedRef.current = true
    markDismissed()
    setPromptOpen(false)
  }

  function applyUpdate() {
    if (!updateWorker) return
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
    updateWorker.postMessage({ type: 'SKIP_WAITING' })
    setUpdateWorker(null)
  }

  const canInstall = installAvailable

  return (
    <>
      <OverlayPortal lockScroll={promptOpen} open={promptOpen}>
      <dialog
        aria-labelledby="pwa-install-title"
        className="pwa-install-dialog"
        onCancel={(event) => {
          event.preventDefault()
          dismissPrompt()
        }}
        onClose={() => setPromptOpen(false)}
        ref={dialogRef}
      >
        <div className="pwa-install-dialog__content">
          <button
            aria-label="Close installation prompt"
            className="pwa-install-dialog__dismiss"
            onClick={dismissPrompt}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
          <span aria-hidden="true" className="pwa-install-dialog__icon">
            <DownloadSimple size={24} weight="bold" />
          </span>
          <p className="pwa-install-dialog__eyebrow">Fixora, ready when you need it</p>
          <h2 id="pwa-install-title">
            {fallbackError
              ? 'Installation is unavailable right now'
              : guide?.title || 'Install Fixora?'}
          </h2>
          <p className="pwa-install-dialog__description">
            {fallbackError
              ? 'Your browser could not open the install prompt. You can try again later.'
              : guide?.description || 'Get quicker access to Fixora by adding it to your device.'}
          </p>
          {guide?.steps?.length > 0 && (
            <ol>
              {guide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          )}
          <div className="pwa-install-dialog__actions">
            {canInstall && !guide && !fallbackError && (
              <button
                className="pwa-install-dialog__install"
                disabled={installing}
                onClick={install}
                type="button"
              >
                {installing ? 'Opening install…' : 'Install'}
              </button>
            )}
            <button
              className="pwa-install-dialog__close"
              onClick={dismissPrompt}
              type="button"
            >
              {guide ? 'Got it' : 'Not now'}
            </button>
          </div>
        </div>
      </dialog>
      </OverlayPortal>

      {updateWorker && (
        <OverlayPortal lockScroll={false} open={false}><aside aria-label="Application update available" className="pwa-update-notice" role="status">
          <span>A Fixora update is ready</span>
          <button onClick={applyUpdate} type="button">
            <ArrowClockwise aria-hidden="true" size={18} weight="bold" />
            Reload to update
          </button>
        </aside></OverlayPortal>
      )}
      {!online && <aside className="pwa-offline-notice" role="status">You’re offline. Check your connection and retry when it’s back.</aside>}
    </>
  )
}
