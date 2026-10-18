import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import './AuthPage.css'

function getCallbackError() {
  const params = new URLSearchParams([
    window.location.search.replace(/^\?/, ''),
    window.location.hash.replace(/^#/, ''),
  ].filter(Boolean).join('&'))
  const code = params.get('error_code') || params.get('error')
  const description = params.get('error_description')
  if (!code && !description) return ''
  if (/expired|otp_expired/i.test(code)) return 'This link has expired. Request a new confirmation email and try again.'
  if (/access_denied/i.test(code)) return 'This sign-in was cancelled. You can try again from the sign-in page.'
  return 'We couldn’t verify this link. Request a new link and try again.'
}

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Finishing your secure sign-in…')
  const [failed, setFailed] = useState(false)
  const handled = useRef(false)
  const { user, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || handled.current) return undefined
    const callbackError = getCallbackError()
    if (!authConfigured || callbackError) {
      setMessage(callbackError || 'Account services are not configured yet.')
      setFailed(true)
      return undefined
    }
    if (!user) {
      setMessage('This link did not provide a valid Fixora session. It may be expired or incomplete. Request a new link and try again.')
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
