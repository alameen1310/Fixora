import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
import OverlayPortal from './OverlayPortal.jsx'
import './PhotoLightbox.css'

export default function PhotoLightbox({ images = [], index = 0, onIndexChange, onClose }) {
  const [zoomed, setZoomed] = useState(false)
  const startX = useRef(null)
  const lastTap = useRef(0)
  const dialogRef = useRef(null)
  const safeIndex = Math.max(0, Math.min(index, images.length - 1))
  const active = images[safeIndex]
  function move(delta) { if (images.length > 1) onIndexChange((safeIndex + delta + images.length) % images.length); setZoomed(false) }

  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'Tab') {
        const controls = [...(dialogRef.current?.querySelectorAll('button:not([disabled])') || [])]
        if (!controls.length) return
        const first = controls[0]; const last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous instanceof HTMLElement && previous.focus() }
  }, [images.length, safeIndex, onClose])

  if (!active) return null
  return <OverlayPortal><div aria-label="Photo viewer" aria-modal="true" className="photo-lightbox" onClick={onClose} role="dialog">
    <div className="photo-lightbox__content" onClick={(event) => event.stopPropagation()} ref={dialogRef} tabIndex={-1}>
      <button aria-label="Close photo viewer" className="photo-lightbox__close" onClick={onClose} type="button"><X size={22} /></button>
      {images.length > 1 && <button aria-label="Previous photo" className="photo-lightbox__previous" onClick={() => move(-1)} type="button"><ArrowLeft size={22} /></button>}
      <img alt={active.alt || 'Photo'} className={zoomed ? 'is-zoomed' : ''} onDoubleClick={() => setZoomed((value) => !value)} onTouchStart={(event) => { startX.current = event.changedTouches[0]?.clientX }} onTouchEnd={(event) => { const delta = event.changedTouches[0]?.clientX - startX.current; if (Math.abs(delta) > 60) move(delta > 0 ? -1 : 1); else { const now = Date.now(); if (now - lastTap.current < 300) setZoomed((value) => !value); lastTap.current = now } }} src={active.src} />
      {images.length > 1 && <button aria-label="Next photo" className="photo-lightbox__next" onClick={() => move(1)} type="button"><ArrowRight size={22} /></button>}
      <span className="photo-lightbox__counter">{safeIndex + 1} / {images.length}</span>
    </div>
  </div></OverlayPortal>
}
