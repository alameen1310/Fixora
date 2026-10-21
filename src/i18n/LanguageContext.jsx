import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, translateInterface } from './catalog.js'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const STORAGE_KEY = 'fixora.language'
const LanguageContext = createContext(null)
const allowed = new Set(LANGUAGES.map(({ code }) => code))

function readSavedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return allowed.has(saved) ? saved : 'en'
  } catch { return 'en' }
}

export function LanguageProvider({ children }) {
  const { user, profile, setProfile } = useAuth()
  const [language, setLanguageState] = useState(readSavedLanguage)
  const [readyForUser, setReadyForUser] = useState(null)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (!user?.id || !profile || readyForUser === user.id) return
    const saved = profile.preferred_language
    if (allowed.has(saved)) {
      setLanguageState(saved)
      try { localStorage.setItem(STORAGE_KEY, saved) } catch { /* Browser storage is optional. */ }
    } else {
      const local = readSavedLanguage()
      if (local !== 'en' && supabase) {
        void supabase.from('profiles').update({ preferred_language: local }).eq('id', user.id)
      }
    }
    setReadyForUser(user.id)
  }, [profile, readyForUser, user?.id])

  useEffect(() => {
    if (!user?.id) setReadyForUser(null)
  }, [user?.id])

  const setLanguage = useCallback(async (next) => {
    if (!allowed.has(next)) return { error: new Error('Unsupported language.') }
    setLanguageState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* Use in-memory state when storage is blocked. */ }
    if (!user?.id || !supabase) return { error: null }
    const { error } = await supabase.from('profiles').update({ preferred_language: next }).eq('id', user.id)
    if (!error && profile) setProfile({ ...profile, preferred_language: next })
    return { error }
  }, [profile, setProfile, user?.id])

  const t = useCallback((text) => translateInterface(language, text), [language])
  const value = useMemo(() => ({ language, languages: LANGUAGES, setLanguage, t }), [language, setLanguage, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider.')
  return value
}


