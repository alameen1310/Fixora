import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeSlash, GoogleLogo } from '@phosphor-icons/react'
import PhoneNumberField, { getE164Phone } from './PhoneNumberField.jsx'
import { Button } from './UiPrimitives.jsx'
import { useToast } from './ToastProvider.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import './SignupForm.css'
import '../pages/AuthPage.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function PasswordField({ error, hint, id, label, onBlur, onChange, onToggle, value, visible }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`auth-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-control">
        <input
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          autoComplete="new-password"
          id={id}
          minLength={id === 'password' ? 8 : undefined}
          name={id}
          onBlur={onBlur}
          onChange={onChange}
          placeholder="Enter password"
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          className="auth-password-toggle"
          onClick={onToggle}
          type="button"
        >
          {visible ? <EyeSlash aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
        </button>
      </div>
      {hint && <span className="auth-field__hint" id={hintId}>{hint}</span>}
      {error && <span className="auth-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}

function validateField(field, value, values) {
  if (field === 'fullName') {
    if (!value.trim()) return 'Enter your full name.'
  }
  if (field === 'email') {
    if (!emailPattern.test(value.trim())) return 'Enter a valid email address.'
  }
  if (field === 'phone') {
    if (!getE164Phone(value, values.phoneCountry)) return 'Enter a valid phone number for the selected country.'
  }
  if (field === 'password') {
    if (value.length < 8) return 'Use at least 8 characters for your password.'
  }
  if (field === 'confirmPassword') {
    if (value !== values.password) return 'Passwords do not match.'
  }
  return null
}

function validateAll(values) {
  const errors = {}
  if (!values.fullName.trim()) errors.fullName = 'Enter your full name.'
  if (!emailPattern.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (!getE164Phone(values.phone, values.phoneCountry)) errors.phone = 'Enter a valid phone number for the selected country.'
  if (values.password.length < 8) errors.password = 'Use at least 8 characters for your password.'
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

function formatSignupError(error) {
  if (/user already registered/i.test(error?.message ?? '')) return 'An account with this email already exists. Sign in instead.'
  if (/password/i.test(error?.message ?? '') && /weak|short|length/i.test(error.message)) return 'Choose a stronger password with at least 8 characters.'
  if (error?.code === 'over_email_send_rate_limit') {
    return 'Fixora reached its email confirmation limit. Please wait a few moments before trying again.'
  }
  if (error?.status === 429 || error?.code === 'over_request_rate_limit' || /rate limit/i.test(error?.message ?? '')) {
    return 'The authentication service is temporarily limiting requests. Please wait a moment and try again.'
  }
  return 'We couldn’t create your account. Please check your details and try again.'
}

export default function SignupForm({ audience }) {
  const isProvider = audience === 'provider'
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    phone: '',
    phoneCountry: 'NG',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [visiblePasswords, setVisiblePasswords] = useState({ password: false, confirmPassword: false })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const requestInFlight = useRef(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      if (field === 'password') delete next.confirmPassword
      return next
    })
    setNotice('')
  }

  function handleBlur(field) {
    const errorMsg = validateField(field, values[field], values)
    setErrors((current) => {
      if (errorMsg) return { ...current, [field]: errorMsg }
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function beginGoogleSignup() {
    if (requestInFlight.current) return
    if (!supabase) {
      setNotice('Account services are not configured yet.')
      return
    }
    requestInFlight.current = true
    setBusy(true)
    try {
      sessionStorage.setItem('fixora.signupType', audience)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch {
      try {
        sessionStorage.removeItem('fixora.signupType')
      } catch {
        // ignore
      }
      requestInFlight.current = false
      setBusy(false)
      showToast({ type: 'error', message: 'Google sign-in could not start. Please try again or use email.' })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (requestInFlight.current) return

    const nextErrors = validateAll(values)
    setErrors(nextErrors)
    setNotice('')

    if (Object.keys(nextErrors).length) {
      const firstError = Object.values(nextErrors)[0]
      showToast({ type: 'error', message: firstError })
      return
    }

    if (!supabase) {
      const msg = 'Account services are not configured yet.'
      setNotice(msg)
      showToast({ type: 'error', message: msg })
      return
    }

    requestInFlight.current = true
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: values.fullName.trim(),
            phone_number: getE164Phone(values.phone, values.phoneCountry),
            fixora_signup_type: audience,
          },
        },
      })
      if (error) throw error
      if (data.session) {
        navigate('/auth/callback', { replace: true })
      } else {
        showToast({
          duration: 0,
          message: 'Check your email for a confirmation link to finish setting up your Fixora account.',
          type: 'info',
        })
      }
    } catch (err) {
      const formatted = formatSignupError(err)
      showToast({ type: 'error', message: formatted })
      setNotice(formatted)
    } finally {
      requestInFlight.current = false
      setBusy(false)
    }
  }

  return (
    <form className="signup-form" data-signup-enter noValidate onSubmit={handleSubmit}>
      <button
        className="auth-google-btn"
        disabled={busy}
        onClick={beginGoogleSignup}
        type="button"
      >
        <GoogleLogo aria-hidden="true" size={20} weight="bold" />
        <span>Continue with Google</span>
      </button>

      <div className="auth-divider">
        <span>or sign up with email</span>
      </div>

      <div className="signup-form__fields">
        <div className={`auth-field${errors.fullName ? ' has-error' : ''}`}>
          <label htmlFor="fullName">Full name</label>
          <input
            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            aria-invalid={Boolean(errors.fullName)}
            autoComplete="name"
            id="fullName"
            name="fullName"
            onBlur={() => handleBlur('fullName')}
            onChange={(event) => update('fullName', event.target.value)}
            placeholder="e.g. Amina Bello"
            required
            value={values.fullName}
          />
          {errors.fullName && (
            <span className="auth-field__error" id="fullName-error" role="alert">
              {errors.fullName}
            </span>
          )}
        </div>

        <div className={`auth-field${errors.email ? ' has-error' : ''}`}>
          <label htmlFor="email">Email address</label>
          <input
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoCapitalize="none"
            autoComplete="email"
            id="email"
            inputMode="email"
            name="email"
            onBlur={() => handleBlur('email')}
            onChange={(event) => update('email', event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={values.email}
          />
          {errors.email && (
            <span className="auth-field__error" id="email-error" role="alert">
              {errors.email}
            </span>
          )}
        </div>

        <PhoneNumberField
          country={values.phoneCountry}
          error={errors.phone}
          onBlur={() => handleBlur('phone')}
          onChange={(value) => update('phone', value)}
          onCountryChange={(value) => update('phoneCountry', value)}
          value={values.phone}
        />

        <PasswordField
          error={errors.password}
          hint="Use at least 8 characters."
          id="password"
          label="Password"
          onBlur={() => handleBlur('password')}
          onChange={(event) => update('password', event.target.value)}
          onToggle={() => setVisiblePasswords((cur) => ({ ...cur, password: !cur.password }))}
          value={values.password}
          visible={visiblePasswords.password}
        />

        <PasswordField
          error={errors.confirmPassword}
          id="confirmPassword"
          label="Confirm password"
          onBlur={() => handleBlur('confirmPassword')}
          onChange={(event) => update('confirmPassword', event.target.value)}
          onToggle={() => setVisiblePasswords((cur) => ({ ...cur, confirmPassword: !cur.confirmPassword }))}
          value={values.confirmPassword}
          visible={visiblePasswords.confirmPassword}
        />
      </div>

      <div className="signup-actions">
        <Button
          className="signup-submit-btn"
          disabled={busy}
          loading={busy}
          type="submit"
          variant="primary"
          wide
        >
          {busy
            ? 'Creating account…'
            : <>Create {isProvider ? 'professional' : 'customer'} account <ArrowRight aria-hidden="true" size={18} weight="bold" /></>}
        </Button>

        <Button
          as={Link}
          className="signup-signin-btn"
          to="/auth/login"
          variant="secondary"
          wide
        >
          Already have an account? Sign in
        </Button>
      </div>

      {notice && (
        <p aria-live="polite" className="auth-notice" role="status">
          {notice}
        </p>
      )}

      {!authConfigured && (
        <p className="auth-config-hint">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment.
        </p>
      )}
    </form>
  )
}
