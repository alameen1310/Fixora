import { useCallback, useEffect, useRef, useState } from 'react'

function atTop(target) {
  for (let node = target; node instanceof HTMLElement; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node.scrollTop <= 0
  }
  return window.scrollY <= 0
}

export default function usePullToRefresh(refresh) {
  const containerRef = useRef(null)
  const startY = useRef(null)
  const active = useRef(false)
  const triggered = useRef(false)
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const trigger = useCallback(async () => {
    if (triggered.current || refreshing) return
    triggered.current = true
    setRefreshing(true)
    setDistance(64)
    try { navigator.vibrate?.(8) } catch { /* vibration is optional */ }
    try { await refreshRef.current?.() } finally { setRefreshing(false); setDistance(0) }
  }, [refreshing])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined
    const onStart = (event) => {
      if (refreshing || event.touches.length !== 1 || event.target.closest?.('[data-no-pull],button,a,input,textarea,select')) return
      if (!atTop(event.target)) return
      startY.current = event.touches[0].clientY
      active.current = true
      triggered.current = false
    }
    const onMove = (event) => {
      if (!active.current || startY.current === null || event.touches.length !== 1) return
      const delta = event.touches[0].clientY - startY.current
      if (delta <= 0) { setDistance(0); return }
      if (atTop(event.target)) event.preventDefault()
      const resisted = Math.min(70, Math.sqrt(delta) * 5)
      setDistance(resisted)
      if (delta >= 70) void trigger()
    }
    const onEnd = () => { active.current = false; startY.current = null; if (!refreshing && !triggered.current) setDistance(0) }
    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd, { passive: true })
    root.addEventListener('touchcancel', onEnd, { passive: true })
    return () => { root.removeEventListener('touchstart', onStart); root.removeEventListener('touchmove', onMove); root.removeEventListener('touchend', onEnd); root.removeEventListener('touchcancel', onEnd) }
  }, [refreshing, trigger])

  const indicator = <div aria-live="polite" className={`pull-refresh-indicator${refreshing ? ' is-refreshing' : ''}`} style={{ '--pull-distance': `${distance}px` }}><span aria-hidden="true" className="pull-refresh-indicator__spinner" />{refreshing ? <span>Refreshing</span> : distance > 20 ? <span>Release to refresh</span> : <span>Pull to refresh</span>}</div>
  return { containerRef, indicator }
}
