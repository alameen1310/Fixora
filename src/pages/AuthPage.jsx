import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleNotch, Eye, EyeSlash, GoogleLogo } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import { Button } from '../components/UiPrimitives.jsx'
import AuthLayout from '../components/AuthLayout.jsx'
import './AuthPage.css'

const modes = {
  login: {
    title: 'Welcome back.',
    description: 'Sign in to your Fixora account to continue.',
    action: 'Sign in',
  },
  forgot: {
    title: 'Reset your password.',
    description: 'We’ll send a secure password reset link to your email.',
    action: 'Send reset link',
  },
  reset: {
    title: 'Choose a new password.',
    description: 'Use at least 8 characters for your new password.',
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
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const busy = Boolean(busyAction)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { authConfigured: configured, user, loading, profileLoading, retrySession } = useAuth()
  const { showToast } = useToast()
  const signedOut = (() => {
    try { return window.sessionStorage.getItem('fixora.signedOut') === '1' } catch { return false }
  })()

  if (mode === 'login' && !loading && user && !profileLoading && !signedOut) {
    return <Navigate replace state={{ returnTo: safeReturnTo(location.state?.returnTo) }} to="/auth/callback" />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!configured) {
      const msg = 'Account services are not configured yet. Add the Supabase environment variables and try again.'
      setError(msg)
      showToast({ type: 'error', message: msg })
      return
    }

    if (mode === 'reset') {
      if (password.length < 8) {
        const msg = 'Use at least 8 characters for your password.'
        setError(msg)
        return
      }
      if (password !== confirmPassword) {
        const msg = 'Passwords do not match.'
        setError(msg)
        return
      }
    }

    setBusyAction('email')
    try {
      if (mode === 'login') {
        try { window.sessionStorage.removeItem('fixora.signedOut') } catch { /* Best effort cleanup. */ }
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
        const { error: syncError } = await retrySession()
        if (syncError) throw new Error('Signed in, but Fixora is restoring your session. Please try again.')
        navigate('/auth/callback', {
          replace: true,
          state: { returnTo: safeReturnTo(location.state?.returnTo) },
        })
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
        if (authError) throw authError
        const msg = 'If an account matches that email, a password-reset link is on its way.'
        setNotice(msg)
        showToast({ type: 'info', message: msg })
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signOutError) {
          const msg = 'Password updated. Please sign in with your new password.'
          setNotice(msg)
          return
        }
        showToast({ type: 'success', message: 'Password updated. Please sign in.' })
        navigate('/auth/login', {
          replace: true,
          state: { notice: 'Password updated. Sign in with your new password.' },
        })
      }
    } catch (authError) {
      const formatted = formatAuthError(authError)
      setError(formatted)
      showToast({ type: 'error', message: formatted })
    } finally {
      setBusyAction('')
    }
  }

  async function handleGoogle() {
    setError('')
    if (!configured) {
      const msg = 'Account services are not configured yet. Add Supabase environment variables.'
      setError(msg)
      showToast({ type: 'error', message: msg })
      return
    }
    setBusyAction('google')
    try {
      try { window.sessionStorage.removeItem('fixora.signedOut') } catch { /* Best effort cleanup. */ }
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (authError) throw authError
    } catch (authError) {
      const formatted = formatAuthError(authError)
      setError(formatted)
      showToast({ type: 'error', message: formatted })
      setBusyAction('')
    }
  }

  const loginNotice = location.state?.notice

  return (
    <AuthLayout backLabel={mode === 'login' ? 'Back to sign up' : 'Back to sign in'} backTo={mode === 'login' ? '/signup/customer' : '/auth/login'} login={mode === 'login'}>
        <section aria-labelledby="auth-title" className="auth-card">
          <div className="auth-heading">
            <h1 className="text-large-title" id="auth-title">{config.title}</h1>
            <p className="auth-description">{config.description}</p>
          </div>

          {mode === 'login' && (
            <button
              className="auth-google-btn"
              disabled={busy}
              onClick={handleGoogle}
              type="button"
            >
              <GoogleLogo aria-hidden="true" size={20} weight="bold" />
              {busyAction === 'google' && <CircleNotch aria-hidden="true" className="ui-button__spinner" size={18} />}
              <span>{busyAction === 'google' ? 'Connecting…' : 'Continue with Google'}</span>
            </button>
          )}

          {mode === 'login' && (
            <div className="auth-divider">
              <span>or use your email</span>
            </div>
          )}

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            {mode !== 'reset' && (
              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <input
                  autoCapitalize="none"
                  disabled={busy}
                  autoComplete="email"
                  id="auth-email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            )}

            {mode !== 'forgot' && (
              <div className="auth-field">
                <label htmlFor="auth-password">
                  {mode === 'reset' ? 'New password' : 'Password'}
                </label>
                <div className="auth-password-control">
                  <input
                    autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                    disabled={busy}
                    id="auth-password"
                    minLength={mode === 'reset' ? 8 : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    required
                    type={visible ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    className="auth-password-toggle"
                    onClick={() => setVisible((current) => !current)}
                    disabled={busy}
                    type="button"
                  >
                    {visible ? <EyeSlash aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <div className="auth-field">
                <label htmlFor="auth-confirm-password">Confirm new password</label>
                <div className="auth-password-control">
                  <input
                    autoComplete="new-password"
                    id="auth-confirm-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat new password"
                    required
                    type={confirmVisible ? 'text' : 'password'}
                    value={confirmPassword}
                  />
                  <button
                    aria-label={confirmVisible ? 'Hide password' : 'Show password'}
                    className="auth-password-toggle"
                    onClick={() => setConfirmVisible((current) => !current)}
                    disabled={busy}
                    type="button"
                  >
                    {confirmVisible ? <EyeSlash aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'reset' && !loading && !user && (
              <p className="auth-error" role="alert">
                Open the latest password-reset link from your email to proceed.
              </p>
            )}

            {loginNotice && mode === 'login' && (
              <p className="auth-notice" role="status">{loginNotice}</p>
            )}

            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}

            <Button
              className="auth-submit-btn"
              disabled={busy || !authConfigured || (mode === 'reset' && !user)}
              loading={busyAction === 'email'}
              type="submit"
              variant="primary"
              wide
            >
              {busyAction === 'email' ? 'Please wait…' : config.action}
              <ArrowRight aria-hidden="true" size={18} weight="bold" />
            </Button>
          </form>

          {mode === 'login' && (
            <div className="auth-secondary-actions" inert={busy}>
              <Button as={Link} className="auth-forgot-btn" to="/auth/forgot-password" variant="ghost" wide>
                Forgot password?
              </Button>
              <Button as={Link} to="/signup/customer" variant="secondary" wide>
                Create an account
              </Button>
            </div>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <div className="auth-secondary-actions" inert={busy}>
              <Button as={Link} to="/auth/login" variant="secondary" wide>
                Return to sign in
              </Button>
            </div>
          )}

          {!authConfigured && (
            <p className="auth-config-hint">
              Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment.
            </p>
          )}
        </section>
    </AuthLayout>
  )
}

function formatAuthError(error) {
  const message = error?.message ?? ''
  if (/invalid login credentials/i.test(message)) return 'That email and password combination was not recognised.'
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address before signing in.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a moment and try again.'
  return 'We couldn’t complete that request. Please check your details and try again.'
}
