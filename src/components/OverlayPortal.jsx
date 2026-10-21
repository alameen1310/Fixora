import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

let openCount = 0
let lockCount = 0
let previousBodyOverflow = ''
let previousBodyOverscroll = ''

function acquire(lockScroll) {
  openCount += 1
  document.documentElement.classList.add('fixora-overlay-open')
  if (lockScroll) {
    if (lockCount === 0) {
      previousBodyOverflow = document.body.style.overflow
      previousBodyOverscroll = document.body.style.overscrollBehavior
      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'
    }
    lockCount += 1
  }
}

function release(lockScroll) {
  openCount = Math.max(0, openCount - 1)
  if (lockScroll) {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.overflow = previousBodyOverflow
      document.body.style.overscrollBehavior = previousBodyOverscroll
    }
  }
  if (openCount === 0) document.documentElement.classList.remove('fixora-overlay-open')
}

export default function OverlayPortal({ children, open = true, lockScroll = true }) {
  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return undefined
    acquire(lockScroll)
    return () => release(lockScroll)
  }, [lockScroll, open])

  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
