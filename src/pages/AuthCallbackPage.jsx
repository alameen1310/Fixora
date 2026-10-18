import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import './AuthPage.css'

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Finishing your secure sign-in…')
  const [failed, setFailed] = useState(false)
  const handled = useRef(false)
  const { user, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || handled.current) return undefined
    const queryError = new URLSearchParams(window.location.search).get('error_description')
      || new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description')
    if (!authConfigured || queryError) {
      setMessage(queryError || 'Account services are not configured yet.')
      setFailed(true)
      return undefined
    }
    if (!user) {
      setMessage('This sign-in link may have expired. Start again from the sign-in page.')
      setFailed(true)
      return undefined
    }

    let alive = true
    handled.current = true
    async function finish() {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_type, onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle()
      if (profileError || !profile) throw profileError ?? new Error('Your profile is still being prepared.')

      let accountType = profile.account_type
      if (!accountType) {
        let storedSignupType = null
        try {
          storedSignupType = sessionStorage.getItem('fixora.signupType')
        } catch {
          // OAuth signup intent is also stored in Auth metadata for email signup.
        }
        const preferredType = user.user_metadata?.fixora_signup_type || storedSignupType
        if (preferredType === 'customer' || preferredType === 'provider') {
          const { data, error } = await supabase.rpc('choose_account_type', { requested_type: preferredType })
          if (error) throw error
          accountType = data
        }
      }

      try {
        sessionStorage.removeItem('fixora.signupType')
        if (accountType !== 'provider') sessionStorage.removeItem('fixora.providerType')
      } catch {
        // Storage cleanup is best-effort; it must not block a valid session.
      }
      const { data: refreshedProfile, error: refreshError } = await refreshProfile()
      if (refreshError) throw refreshError
      if (!alive) return
      setFailed(false)
      const completedAt = refreshedProfile?.onboarding_completed_at ?? profile.onboarding_completed_at
      const resolvedType = refreshedProfile?.account_type ?? accountType
      if (!resolvedType) navigate('/onboarding/account-type', { replace: true })
      else if (!completedAt) navigate(`/onboarding/${resolvedType}`, { replace: true })
      else navigate('/app', { replace: true })
    }

    finish().catch(() => {
      if (!alive) return
      setMessage('We couldn’t finish setting up your account. Please try signing in again.')
      setFailed(true)
    })
    return () => { alive = false }
  }, [loading, user, navigate, refreshProfile])

  return (
    <main className="account-state">
      <section className="account-state__panel" aria-live="polite">
        <p className="auth-kicker">Fixora account</p>
        <h1>{failed ? 'Sign-in needs another step.' : 'One moment.'}</h1>
        <p role={failed ? 'alert' : 'status'}>{message}</p>
        {failed && <Link className="account-action" to="/auth/login">Go to sign in</Link>}
      </section>
    </main>
  )
}
