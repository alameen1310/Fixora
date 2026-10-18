import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authConfigured, supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)
const profileColumns = 'id, full_name, phone_number, phone_verified_at, account_type, onboarding_completed_at'
const SESSION_TIMEOUT_MS = 12000
const PROFILE_TIMEOUT_MS = 12000

function isCurrentSession(current, expected) {
  return current?.user?.id === expected?.user?.id
}

function profileMessage(error, missing = false) {
  if (missing) return 'Your Fixora profile was not found. Please try again or contact support.'
  if (error?.name === 'AbortError') return 'Loading your Fixora profile took too long. Check your connection and try again.'
  return 'We couldn’t load your Fixora profile. Check your connection and try again.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionReady, setSessionReady] = useState(!authConfigured)
  const [sessionError, setSessionError] = useState('')
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const sessionRef = useRef(null)
  const authRevision = useRef(0)
  const profileRequest = useRef(0)

  useEffect(() => {
    if (!supabase) return undefined

    let alive = true
    const readRevision = authRevision.current
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return

      // Keep this callback synchronous: Supabase auth processing must not wait on profile I/O.
      authRevision.current += 1
      sessionRef.current = nextSession ?? null
      setSession(nextSession ?? null)
      setSessionReady(true)
      setSessionError('')
      if (nextSession?.user?.id) {
        setProfile(null)
        setProfileError('')
        setProfileLoading(true)
      } else {
        profileRequest.current += 1
        setProfile(null)
        setProfileError('')
        setProfileLoading(false)
      }
    })

    const timer = window.setTimeout(() => {
      if (!alive || authRevision.current !== readRevision) return
      setSessionError('We couldn’t restore your Fixora session. Check your connection and try again.')
      setSessionReady(true)
    }, SESSION_TIMEOUT_MS)

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!alive || authRevision.current !== readRevision) return
        window.clearTimeout(timer)
        if (error) throw error
        const restoredSession = data?.session ?? null
        sessionRef.current = restoredSession
        setSession(restoredSession)
        setSessionError('')
        setSessionReady(true)
        setProfileLoading(Boolean(restoredSession?.user?.id))
      })
      .catch(() => {
        if (!alive || authRevision.current !== readRevision) return
        window.clearTimeout(timer)
        setSessionError('We couldn’t restore your Fixora session. Check your connection and try again.')
        setSessionReady(true)
      })

    return () => {
      alive = false
      window.clearTimeout(timer)
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const currentSession = session
    if (!supabase || !currentSession?.user?.id) {
      profileRequest.current += 1
      setProfile(null)
      setProfileLoading(false)
      setProfileError('')
      return undefined
    }

    const requestId = ++profileRequest.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS)
    let alive = true
    setProfile(null)
    setProfileLoading(true)
    setProfileError('')

    supabase
      .from('profiles')
      .select(profileColumns)
      .eq('id', currentSession.user.id)
      .abortSignal(controller.signal)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || requestId !== profileRequest.current || !isCurrentSession(sessionRef.current, currentSession)) return
        if (error || !data) {
          setProfile(null)
          setProfileError(profileMessage(error, !error && !data))
        } else {
          setProfile(data)
          setProfileError('')
        }
        setProfileLoading(false)
      })
      .catch((error) => {
        if (!alive || requestId !== profileRequest.current || !isCurrentSession(sessionRef.current, currentSession)) return
        setProfile(null)
        setProfileError(profileMessage(error))
        setProfileLoading(false)
      })
      .finally(() => window.clearTimeout(timer))

    return () => {
      alive = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [session?.user?.id])

  const retrySession = useCallback(async () => {
    if (!supabase) return { data: null, error: new Error('Account services are not configured.') }
    const revision = authRevision.current
    setSessionError('')
    setSessionReady(false)
    let timer
    try {
      const timeout = new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('Session check timed out.')), SESSION_TIMEOUT_MS)
      })
      const { data, error } = await Promise.race([supabase.auth.getSession(), timeout])
      if (error) throw error
      if (authRevision.current !== revision) return { data: { session: sessionRef.current }, error: null }
      const restoredSession = data?.session ?? null
      sessionRef.current = restoredSession
      setSession(restoredSession)
      setSessionReady(true)
      return { data, error: null }
    } catch (error) {
      if (authRevision.current === revision) {
        setSessionReady(true)
        setSessionError('We couldn’t restore your Fixora session. Check your connection and try again.')
      }
      return { data: null, error }
    } finally {
      window.clearTimeout(timer)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const currentSession = sessionRef.current
    if (!supabase || !currentSession?.user?.id) {
      return { data: null, error: new Error('No authenticated Fixora session is available.') }
    }

    const requestId = ++profileRequest.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS)
    setProfileLoading(true)
    setProfileError('')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(profileColumns)
        .eq('id', currentSession.user.id)
        .abortSignal(controller.signal)
        .maybeSingle()
      if (requestId !== profileRequest.current || !isCurrentSession(sessionRef.current, currentSession)) {
        return { data: null, error: new Error('The active session changed while the profile was loading.') }
      }
      if (error || !data) {
        const resolvedError = error ?? new Error('Your Fixora profile was not found.')
        setProfile(null)
        setProfileError(profileMessage(error, !error && !data))
        setProfileLoading(false)
        return { data: null, error: resolvedError }
      }
      setProfile(data)
      setProfileError('')
      setProfileLoading(false)
      return { data, error: null }
    } catch (error) {
      if (requestId === profileRequest.current && isCurrentSession(sessionRef.current, currentSession)) {
        setProfile(null)
        setProfileError(profileMessage(error))
        setProfileLoading(false)
      }
      return { data: null, error }
    } finally {
      window.clearTimeout(timer)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return { error: new Error('Account services are not configured.') }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      // An expired or missing remote session is already signed out from the user's perspective.
      if (!/session|jwt|token|not found|missing/i.test(error?.message ?? '')) return { error }
    }

    authRevision.current += 1
    profileRequest.current += 1
    sessionRef.current = null
    setSession(null)
    setSessionReady(true)
    setSessionError('')
    setProfile(null)
    setProfileError('')
    setProfileLoading(false)
    return { error: null }
  }, [])

  const value = useMemo(() => ({
    authConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loading: authConfigured && !sessionReady,
    sessionError,
    retrySession,
    profileLoading,
    profileError,
    setProfile,
    refreshProfile,
    signOut,
  }), [session, profile, sessionReady, sessionError, retrySession, profileLoading, profileError, refreshProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
