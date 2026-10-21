import { supabase } from '../lib/supabase.js'
import { CATALOG_VERSION } from './catalog.js'

const STORAGE_PREFIX = 'fixora.translation.v1:'
const STORAGE_INDEX = 'fixora.translation.index.v1'
const MAX_CACHE_ITEMS = 160
const pending = new Map()
const queued = new Map()
const timers = new Map()

async function cacheKey(text, target, source = 'auto') {
  const payload = `${CATALOG_VERSION}\u0000${source}\u0000${target}\u0000${text.trim().replace(/\s+/g, ' ')}`
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function remember(key, value) {
  try {
    const index = JSON.parse(localStorage.getItem(STORAGE_INDEX) || '[]').filter((item) => item !== key)
    index.push(key)
    while (index.length > MAX_CACHE_ITEMS) localStorage.removeItem(`${STORAGE_PREFIX}${index.shift()}`)
    localStorage.setItem(STORAGE_PREFIX + key, value)
    localStorage.setItem(STORAGE_INDEX, JSON.stringify(index))
  } catch { /* Persistent caching is an optimization; server cache and original fallback remain. */ }
}

export async function translateDynamicText(text, target) {
  if (typeof text !== 'string' || text.trim().length < 2 || text.length > 1600 || target === 'en') return null
  const key = await cacheKey(text, target)
  try {
    const cached = localStorage.getItem(STORAGE_PREFIX + key)
    if (cached) return cached
  } catch { /* Continue to request if storage is blocked. */ }
  if (pending.has(key)) return pending.get(key)
  if (!supabase) return null
  const request = new Promise((resolve) => {
    const group = queued.get(target) || []
    group.push({ id: key, text, resolve })
    queued.set(target, group)
    if (!timers.has(target)) timers.set(target, window.setTimeout(() => { void flush(target) }, 55))
  })
  pending.set(key, request)
  return request.finally(() => pending.delete(key))
}

async function flush(target) {
  const items = queued.get(target) || []
  queued.delete(target)
  timers.delete(target)
  const chunks = []
  for (let index = 0; index < items.length; index += 5) chunks.push(items.slice(index, index + 5))
  await Promise.all(chunks.map(async (chunk) => {
    let translations = {}
    try {
      const { data, error } = await supabase.functions.invoke('fixora-translate', { body: { target, items: chunk.map(({ id, text }) => ({ id, text })) } })
      if (!error && data?.translations && typeof data.translations === 'object') translations = data.translations
    } catch { /* Original text remains visible when the server or network is unavailable. */ }
    chunk.forEach(({ id, text, resolve }) => {
      const translated = translations[id]
      if (typeof translated === 'string' && translated.trim() && translated !== text) remember(id, translated)
      resolve(typeof translated === 'string' && translated.trim() && translated !== text ? translated : null)
    })
  }))
}
