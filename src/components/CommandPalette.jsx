import { useEffect, useMemo, useRef, useState } from 'react'
import OverlayPortal from './OverlayPortal.jsx'
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { appQueryCache } from '../lib/postListCache.js'
import { useDismissable } from '../hooks/useDismissable.js'
import './CommandPalette.css'

const PAGES = [
  { label: 'Home', to: '/app', keywords: 'dashboard requests' },
  { label: 'Discover professionals', to: '/app/discover', keywords: 'find work providers' },
  { label: 'Activity', to: '/app/activity', keywords: 'applications updates' },
  { label: 'Messages', to: '/app/messages', keywords: 'chat conversations' },
  { label: 'Profile', to: '/app/profile', keywords: 'account settings' },
  { label: 'My Posts', to: '/app/my-posts', keywords: 'requests' },
]

function matches(text, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const value = text.toLowerCase()
  return words.every((word) => value.includes(word) || [...word].reduce((position, letter) => position < 0 ? -1 : value.indexOf(letter, position + 1), 0) >= 0)
}

export default function CommandPalette({ isCustomer }) {
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boundaryRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  useDismissable({ boundaryRef, open: open || helpOpen, onDismiss: () => { setOpen(false); setHelpOpen(false) } })

  useEffect(() => {
    const onKey = (event) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))
      const desktop = window.matchMedia('(min-width: 768px) and (pointer: fine)').matches
      if (!desktop) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setHelpOpen(false); setOpen(true) }
      else if (event.key === '?' && !typing) { event.preventDefault(); setOpen(false); setHelpOpen(true) }
      else if (event.key === '/' && !typing) { event.preventDefault(); document.querySelector('input[type="search"],input[placeholder*="Search" i]')?.focus() }
      else if (event.key.toLowerCase() === 'n' && !typing && isCustomer) { event.preventDefault(); navigate('/app/posts/new') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isCustomer, navigate])

  useEffect(() => { if (open) { setQuery(''); setActive(0); requestAnimationFrame(() => inputRef.current?.focus()) } }, [open])

  const items = useMemo(() => {
    const pages = PAGES.filter((item) => (isCustomer || item.to !== '/app/my-posts'))
      .map((item) => !isCustomer && item.to === '/app/discover' ? { ...item, label: 'Find work' } : item)
    const dynamic = []
    for (const [key, value] of appQueryCache.entries()) {
      if (!String(key).startsWith(`${user?.id}:`)) continue
      for (const row of value.conversations ?? []) dynamic.push({ label: `${row.other_display_name} · ${row.post_title}`, to: `/app/messages/${row.conversation_id}`, keywords: 'conversation message' })
      for (const row of value.profiles ?? []) dynamic.push({ label: row.display_name, to: `/app/professionals/${row.profile_id}`, keywords: 'professional provider profile' })
    }
    if (isCustomer) dynamic.push({ label: 'Post a problem', to: '/app/posts/new', keywords: 'create request action' })
    const unique = new Map([...pages, ...dynamic].map((item) => [item.to, item]))
    const all = [...unique.values()]
    return query ? all.filter((item) => matches(`${item.label} ${item.keywords || ''}`, query)) : all
  }, [isCustomer, open, query, user?.id])

  useEffect(() => { setActive((current) => Math.min(current, Math.max(0, items.length - 1))) }, [items.length])
  function choose(item) { setOpen(false); navigate(item.to) }
  function onListKey(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => (value + 1) % items.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => (value - 1 + items.length) % items.length) }
    if (event.key === 'Enter' && items[active]) { event.preventDefault(); choose(items[active]) }
  }

  return <>
    {(open || helpOpen) && <OverlayPortal><div aria-label={helpOpen ? 'Keyboard shortcuts' : 'Command palette'} aria-modal="true" className="command-palette-backdrop" onClick={() => { setOpen(false); setHelpOpen(false) }} role="dialog">
      <section className="command-palette" onClick={(event) => event.stopPropagation()} ref={boundaryRef}>
        <button aria-label="Close" className="command-palette__close" onClick={() => { setOpen(false); setHelpOpen(false) }} type="button"><X size={18} /></button>
        {helpOpen ? <><h2>Keyboard shortcuts</h2><div className="command-palette__shortcuts"><p><kbd>Ctrl</kbd> <span>or</span> <kbd>⌘</kbd> <kbd>K</kbd><span>Open search</span></p><p><kbd>/</kbd><span>Focus page search</span></p>{isCustomer && <p><kbd>N</kbd><span>Post a problem</span></p>}<p><kbd>?</kbd><span>Show shortcuts</span></p></div></> : <><label className="command-palette__search"><MagnifyingGlass size={20} /><input onChange={(event) => setQuery(event.target.value)} onKeyDown={onListKey} placeholder="Search Fixora…" ref={inputRef} value={query} /><kbd>ESC</kbd></label><div className="command-palette__results" role="listbox">{items.length ? items.map((item, index) => <button aria-selected={active === index} className={active === index ? 'is-active' : ''} key={`${item.to}-${item.label}`} onClick={() => choose(item)} onMouseEnter={() => setActive(index)} role="option" type="button"><span>{item.label}</span><ArrowRight size={17} /></button>) : <p>No matching pages or saved items.</p>}</div></>}
      </section>
    </div></OverlayPortal>}
  </>
}
