import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authConfigured, supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

const profileColumns = 'id, full_name, phone_number, phone_verified_at, account_type, onboarding_completed_at'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!supabase) return undefined

    let alive = true
    let authEventReceived = false
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return
      authEventReceived = true
      setSession(nextSession)
      setSessionReady(true)
      if (nextSession) {
        setProfileLoading(true)
      } else {
        setProfile(null)
        setProfileError('')
        setProfileLoading(false)
      }
    })

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!alive) return
        if (!authEventReceived) setSession(data?.session ?? null)
        setProfileError(error?.message ?? '')
        setProfileLoading(Boolean(data?.session?.user?.id))
        setSessionReady(true)
      })
      .catch(() => {
        if (!alive) return
        if (!authEventReceived) setSession(null)
        setProfileError('We couldn’t restore your Fixora session. Please try signing in again.')
        setProfileLoading(false)
        setSessionReady(true)
      })

    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return undefined
    }

    let alive = true
    setProfileLoading(true)
    setProfileError('')
    supabase
      .from('profiles')
      .select(profileColumns)
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        setProfile(data)
        setProfileError(error?.message ?? (data ? '' : 'Your profile was not found.'))
        setProfileLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setProfileError('We couldn’t load your Fixora profile. Please try again.')
        setProfileLoading(false)
      })

    return () => { alive = false }
  }, [session?.user?.id, session?.access_token])

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      return { data: null, error: new Error('No authenticated Fixora session is available.') }
    }

    setProfileLoading(true)
    setProfileError('')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(profileColumns)
        .eq('id', session.user.id)
        .maybeSingle()
      setProfile(data)
      setProfileError(error?.message ?? (data ? '' : 'Your profile was not found.'))
      return { data, error: error ?? (data ? null : new Error('Your profile was not found.')) }
    } catch (error) {
      setProfileError('We couldn’t load your Fixora profile. Please try again.')
      return { data: null, error }
    } finally {
      setProfileLoading(false)
    }
  }, [session?.user?.id])

  const value = useMemo(() => ({
    authConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loading: authConfigured && !sessionReady,
    profileLoading,
    profileError,
    setProfile,
    refreshProfile,
  }), [session, profile, sessionReady, profileLoading, profileError, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
