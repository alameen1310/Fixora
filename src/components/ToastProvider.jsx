import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react'
import './ToastProvider.css'

const ToastContext = createContext(null)
const toastIcons = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
  warning: Warning,
}
const defaultDurations = { success: 4500, info: 6500, warning: 9000, error: 0 }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastsRef = useRef([])
  const timers = useRef(new Map())
  const sequence = useRef(0)

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current.clear()
  }, [])

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    toastsRef.current = toastsRef.current.filter((toast) => toast.id !== id)
    setToasts(toastsRef.current)
  }, [])

  const showToast = useCallback(({ type = 'info', message, duration } = {}) => {
    if (!message || !toastIcons[type]) return null
    const existing = toastsRef.current.find((toast) => toast.type === type && toast.message === message)
    if (existing) return existing.id

    const id = ++sequence.current
    const toast = { id, type, message }
    const next = [...toastsRef.current, toast]
    const removed = next.length > 3 ? next.splice(0, next.length - 3) : []
    removed.forEach((item) => {
      clearTimeout(timers.current.get(item.id))
      timers.current.delete(item.id)
    })
    toastsRef.current = next
    setToasts(next)

    const timeout = duration ?? defaultDurations[type]
    if (timeout > 0) timers.current.set(id, setTimeout(() => dismissToast(id), timeout))
    return id
  }, [dismissToast])

  const contextValue = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <aside aria-label="Notifications" className="fixora-toasts">
        {toasts.map(({ id, type, message }) => {
          const Icon = toastIcons[type]
          return (
            <div aria-atomic="true" aria-live={type === 'error' ? 'assertive' : 'polite'} className={`fixora-toast fixora-toast--${type}`} key={id} role={type === 'error' ? 'alert' : 'status'}>
              <Icon aria-hidden="true" className="fixora-toast__icon" size={22} weight="fill" />
              <p>{message}</p>
              <button aria-label="Dismiss notification" className="fixora-toast__dismiss" onClick={() => dismissToast(id)} type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          )
        })}
      </aside>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider.')
  return context
}
