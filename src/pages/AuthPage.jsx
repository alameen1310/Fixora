import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, GoogleLogo } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import { Button, Logo } from '../components/UiPrimitives.jsx'
import './AuthPage.css'

const modes = {
  login: {
    title: 'Welcome back.',
    description: 'Sign in to continue with Fixora.',
    action: 'Sign in',
  },
  forgot: {
    title: 'Reset your password.',
    description: 'We’ll send a secure password-reset link to your email.',
    action: 'Send reset link',
  },
  reset: {
    title: 'Choose a new password.',
    description: 'Use at least eight characters for your new password.',
    action: 'Update password',
  },
}

function safeReturnTo(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : null
}

export default function AuthPage({ mode = 'login' }) {
  const config = modes[mode]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { authConfigured: configured, user, loading, profileLoading, retrySession } = useAuth()

  if (mode === 'login' && !loading && user && !profileLoading) {
    return <Navigate replace to="/auth/callback" state={{ returnTo: safeReturnTo(location.state?.returnTo) }} />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!configured) {
      setError('Account services are not configured yet. Add the Supabase environment variables and try again.')
      return
    }
    if (mode !== 'forgot' && mode === 'reset' && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    if (mode === 'reset' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        const { error: syncError } = await retrySession()
        if (syncError) throw new Error('You are signed in, but Fixora could not restore the session yet. Please try again.')
        navigate('/auth/callback', { replace: true, state: { returnTo: safeReturnTo(location.state?.returnTo) } })
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (authError) throw authError
        setNotice('If an account matches that email, a password-reset link is on its way.')
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) {
          setNotice('Your password was updated, but we couldn’t end this session. Please sign out before using your new password.')
          return
        }
        navigate('/auth/login', { replace: true, state: { notice: 'Your password was updated. Sign in with your new password.' } })
      }
    } catch (authError) {
      setError(formatAuthError(authError))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    if (!configured) {
      setError('Account services are not configured yet. Add the Supabase environment variables and try again.')
      return
    }
    setBusy(true)
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (authError) throw authError
    } catch (authError) {
      setError(formatAuthError(authError))
      setBusy(false)
    }
  }

  const loginNotice = location.state?.notice

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-card">
        <Logo className="auth-back" />
        <p className="auth-kicker">Your home, in good hands</p>
        <h1 id="auth-title">{config.title}</h1>
        <p className="auth-description">{config.description}</p>

        {mode === 'login' && (
          <button className="auth-google" disabled={busy} onClick={handleGoogle} type="button">
            <GoogleLogo aria-hidden="true" size={20} weight="bold" />
            Continue with Google
          </button>
        )}

        {mode === 'login' && <div className="auth-divider"><span>or use your email</span></div>}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          {mode !== 'reset' && <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input autoComplete="email" id="auth-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </div>}
          {mode !== 'forgot' && (
            <div className="auth-field">
              <label htmlFor="auth-password">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <div className="auth-password">
                <input
                  autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                  id="auth-password"
                  minLength={mode === 'reset' ? 8 : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={visible ? 'text' : 'password'}
                  value={password}
                />
                <button aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((current) => !current)} type="button">
                  {visible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
          {mode === 'reset' && (
            <div className="auth-field">
              <label htmlFor="auth-confirm-password">Confirm new password</label>
              <input autoComplete="new-password" id="auth-confirm-password" onChange={(event) => setConfirmPassword(event.target.value)} required type={visible ? 'text' : 'password'} value={confirmPassword} />
            </div>
          )}
          {mode === 'reset' && !loading && !user && <p className="auth-error" role="alert">Open the newest password-reset link from your email to continue.</p>}
          {loginNotice && mode === 'login' && <p className="auth-notice" role="status">{loginNotice}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button className="auth-submit" disabled={busy || !authConfigured || (mode === 'reset' && !user)} loading={busy} type="submit" variant="primary" wide>
            {busy ? 'Please wait…' : config.action}
            <ArrowRight aria-hidden="true" size={19} weight="bold" />
          </Button>
        </form>

        {mode === 'login' && <div className="auth-support-actions"><Button as={Link} to="/auth/forgot-password" variant="ghost" wide>Forgot password?</Button><Button as={Link} to="/signup/customer" variant="secondary" wide>Create an account</Button></div>}
        {mode === 'login' && <Button as={Link} className="auth-support-actions__provider" to="/signup/provider" variant="ghost" wide>Join as a professional</Button>}
        {mode === 'forgot' && <Button as={Link} className="auth-support-actions__provider" to="/auth/login" variant="secondary" wide>Return to sign in</Button>}
        {mode === 'reset' && <Button as={Link} className="auth-support-actions__provider" to="/auth/login" variant="secondary" wide>Return to sign in</Button>}
        {!authConfigured && <p className="auth-config-hint">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your local environment.</p>}
      </section>
    </main>
  )
}

function formatAuthError(error) {
  const message = error?.message ?? ''
  if (/invalid login credentials/i.test(message)) return 'That email and password combination was not recognised.'
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email from the link we sent before signing in.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a little and try again.'
  return 'We couldn’t complete that request. Check your details and try again.'
}
