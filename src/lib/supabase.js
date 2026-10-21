import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const TAB_AUTH_STORAGE_KEY = 'fixora.auth.storage-key'
const tabAuthStorage = (() => {
  try {
    return window.sessionStorage
  } catch {
    const memory = new Map()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    }
  }
})()

function getTabAuthStorageKey() {
  let key = tabAuthStorage.getItem(TAB_AUTH_STORAGE_KEY)
  if (!key) {
    const tabId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    key = `fixora-auth-${tabId}`
    tabAuthStorage.setItem(TAB_AUTH_STORAGE_KEY, key)
    migrateLegacySession(key)
  }
  return key
}

function migrateLegacySession(tabStorageKey) {
  if (!supabaseUrl) return
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    const legacyKey = `sb-${projectRef}-auth-token`
    for (const key of Object.keys(window.localStorage)) {
      if (key === legacyKey || key.startsWith(`${legacyKey}-`)) {
        const value = window.localStorage.getItem(key)
        if (value !== null) tabAuthStorage.setItem(`${tabStorageKey}${key.slice(legacyKey.length)}`, value)
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // The user can still sign in again if legacy browser storage is unavailable.
  }
}

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: tabAuthStorage,
      storageKey: getTabAuthStorageKey(),
    },
  })
  : null

export const authConfigured = Boolean(supabase)
