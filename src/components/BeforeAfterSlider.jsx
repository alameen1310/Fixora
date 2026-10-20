import { useMemo, useRef, useState } from 'react'
import { getPostImageUrl } from '../lib/postImages.js'
import './BeforeAfterSlider.css'

function imageUrl(image) { return image?.url || getPostImageUrl(image?.storage_path) }

export default function BeforeAfterSlider({ before = [], after = [], title = 'Completed work' }) {
  const [position, setPosition] = useState(50)
  const [beforeIndex, setBeforeIndex] = useState(0)
  const [afterIndex, setAfterIndex] = useState(0)
  const trackRef = useRef(null)
  const beforeImages = useMemo(() => before.filter((image) => imageUrl(image)), [before])
  const afterImages = useMemo(() => after.filter((image) => imageUrl(image)), [after])
  const currentBefore = beforeImages[beforeIndex]
  const currentAfter = afterImages[afterIndex]
  const hasBoth = currentBefore && currentAfter

  function updatePosition(event) {
    const bounds = trackRef.current?.getBoundingClientRect()
    if (!bounds) return
    setPosition(Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)))
  }

  function keyAdjust(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setPosition((current) => Math.min(100, Math.max(0, current + (event.key === 'ArrowRight' ? 5 : -5))))
  }

  if (!hasBoth) return <div className="before-after-single">{[currentBefore, currentAfter].filter(Boolean).map((image, index) => <figure key={image.storage_path || image.url}><img alt={`${title}, ${image.kind || (currentBefore ? 'before' : 'after')} photo ${index + 1}`} src={imageUrl(image)} /><figcaption>{image.kind === 'after' || image === currentAfter ? 'After' : 'Before'}</figcaption></figure>)}</div>

  return <div className="before-after-viewer">
    <div aria-label="Compare before and after photos" className="before-after-track" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updatePosition(event) }} onPointerMove={(event) => { if (event.buttons) updatePosition(event) }} ref={trackRef}>
      <img alt={`${title}, after`} className="before-after-track__after" onError={(event) => { event.currentTarget.hidden = true }} src={imageUrl(currentAfter)} />
      <div className="before-after-track__before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img alt={`${title}, before`} onError={(event) => { event.currentTarget.hidden = true }} src={imageUrl(currentBefore)} /></div>
      <span className="before-after-track__label before-after-track__label--before">Before</span><span className="before-after-track__label before-after-track__label--after">After</span>
      <button aria-label="Drag to compare before and after photos" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(position)} className="before-after-track__handle" onKeyDown={keyAdjust} role="slider" style={{ left: `${position}%` }} type="button"><span /></button>
    </div>
    {(beforeImages.length > 1 || afterImages.length > 1) && <div className="before-after-thumbnails">
      {beforeImages.length > 1 && <div aria-label="Before photos" className="before-after-thumbnails__side">{beforeImages.map((image, index) => <button aria-label={`Show before photo ${index + 1}`} aria-pressed={index === beforeIndex} key={image.storage_path} onClick={() => setBeforeIndex(index)} type="button"><img alt="" src={imageUrl(image)} /></button>)}</div>}
      {afterImages.length > 1 && <div aria-label="After photos" className="before-after-thumbnails__side">{afterImages.map((image, index) => <button aria-label={`Show after photo ${index + 1}`} aria-pressed={index === afterIndex} key={image.storage_path} onClick={() => setAfterIndex(index)} type="button"><img alt="" src={imageUrl(image)} /></button>)}</div>}
    </div>}
  </div>
}
