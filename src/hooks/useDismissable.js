import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useDismissable({ boundaryRef, ignoreRef, open, onDismiss }) {
  const { key, pathname } = useLocation()

  useEffect(() => {
    if (!open) return undefined
    const focusTarget = document.activeElement
    const dismiss = () => onDismiss()
    const onPointerDown = (event) => {
      if (!boundaryRef.current?.contains(event.target) && !ignoreRef?.current?.contains(event.target)) dismiss()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
        if (focusTarget instanceof HTMLElement) focusTarget.focus()
      }
    }
    const onBlur = () => dismiss()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', dismiss, true)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [boundaryRef, ignoreRef, key, pathname, open, onDismiss])
}
