import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Eye, EyeSlash, GoogleLogo } from '@phosphor-icons/react'
import PhoneNumberField, { getE164Phone } from './PhoneNumberField.jsx'
import LoadingIndicator from './LoadingIndicator.jsx'
import { Button } from './UiPrimitives.jsx'
import { useToast } from './ToastProvider.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import './SignupForm.css'
import '../pages/AuthPage.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function PasswordField({ error, id, label, onChange, value, visible, onToggle, hint }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`signup-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="signup-password-control">
        <input aria-describedby={describedBy} aria-invalid={Boolean(error)} autoComplete="new-password" id={id} minLength={id === 'password' ? 8 : undefined} name={id} onChange={onChange} required type={visible ? 'text' : 'password'} value={value} />
        <button aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} className="signup-password-toggle" onClick={onToggle} type="button">
          {visible ? <EyeSlash aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          <span>{visible ? 'Hide' : 'Show'}</span>
        </button>
      </div>
      {hint && <span className="signup-field__hint" id={hintId}>{hint}</span>}
      {error && <span className="signup-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}

function validate(values) {
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
    return 'Fixora has reached its confirmation-email sending limit. Please wait before trying again. If you already confirmed your email, use the sign-in link below.'
  }
  if (error?.status === 429 || error?.code === 'over_request_rate_limit' || /rate limit/i.test(error?.message ?? '')) {
    return 'The authentication service is temporarily limiting requests. Please wait before trying again.'
  }
  return 'We couldn’t create your account. Check your details and try again.'
}

function clearSignupIntent() {
  try {
    sessionStorage.removeItem('fixora.signupType')
    sessionStorage.removeItem('fixora.providerType')
  } catch {
    // Storage cleanup is best-effort and should not mask the Auth error.
  }
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

  async function beginGoogleSignup() {
    if (requestInFlight.current) return
    if (!supabase) {
      setNotice('Account services are not configured yet. Add the Supabase environment variables to enable registration.')
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
      clearSignupIntent()
      requestInFlight.current = false
      setBusy(false)
      showToast({ type: 'error', message: 'Google sign-in could not start. Check that this browser allows site storage, then try again or continue with email.' })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (requestInFlight.current) return
    const nextErrors = validate(values)
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length) return
    if (!supabase) {
      setNotice('Account services are not configured yet. Add the Supabase environment variables to enable registration.')
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
        showToast({ type: 'info', duration: 0, message: 'Check your email for a confirmation link. After confirming, we’ll continue setting up your Fixora account.' })
      }
    } catch (error) {
      showToast({ type: 'error', message: formatSignupError(error) })
    } finally {
      requestInFlight.current = false
      setBusy(false)
    }
  }

  const emailField = (
    <div className={`signup-field${errors.email ? ' has-error' : ''}`}>
      <label htmlFor="email">Email address</label>
      <input aria-describedby={errors.email ? 'email-error' : undefined} aria-invalid={Boolean(errors.email)} autoComplete="email" id="email" name="email" onChange={(event) => update('email', event.target.value)} required type="email" value={values.email} />
      {errors.email && <span className="signup-field__error" id="email-error" role="alert">{errors.email}</span>}
    </div>
  )
  const nameField = (field, label, autocomplete) => (
    <div className={`signup-field${errors[field] ? ' has-error' : ''}`}>
      <label htmlFor={field}>{label}</label>
      <input aria-describedby={errors[field] ? `${field}-error` : undefined} aria-invalid={Boolean(errors[field])} autoComplete={autocomplete} id={field} name={field} onChange={(event) => update(field, event.target.value)} required value={values[field]} />
      {errors[field] && <span className="signup-field__error" id={`${field}-error`} role="alert">{errors[field]}</span>}
    </div>
  )
  const passwordFields = (
    <>
      <PasswordField error={errors.password} hint="Use at least 8 characters." id="password" label="Password" onChange={(event) => update('password', event.target.value)} onToggle={() => setVisiblePasswords((current) => ({ ...current, password: !current.password }))} value={values.password} visible={visiblePasswords.password} />
      <PasswordField error={errors.confirmPassword} id="confirmPassword" label="Confirm password" onChange={(event) => update('confirmPassword', event.target.value)} onToggle={() => setVisiblePasswords((current) => ({ ...current, confirmPassword: !current.confirmPassword }))} value={values.confirmPassword} visible={visiblePasswords.confirmPassword} />
    </>
  )
  return (
    <form className="signup-form" data-signup-enter noValidate onSubmit={handleSubmit}>
      <div className="signup-form__section-heading">
        <h2>{isProvider ? 'Create your account' : 'Your details'}</h2>
        <p>{isProvider ? 'Start with the essentials. You’ll add your professional profile after your account is ready.' : 'A few essentials to get your Fixora account started.'}</p>
      </div>
      <button className="signup-google" disabled={busy} onClick={beginGoogleSignup} type="button">{busy ? <LoadingIndicator /> : <GoogleLogo aria-hidden="true" size={20} weight="bold" />} Continue with Google</button>
      <div className={`signup-form__fields${isProvider ? ' signup-form__fields--provider' : ''}`}>
        {isProvider ? <>
          {nameField('fullName', 'Your full name', 'name')}
          <div className="signup-provider-contact">
            {emailField}
            <PhoneNumberField country={values.phoneCountry} error={errors.phone} onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} />
          </div>
          <div className="signup-provider-passwords">{passwordFields}</div>
        </> : <>
          {nameField('fullName', 'Full name', 'name')}
          {emailField}
          <PhoneNumberField country={values.phoneCountry} error={errors.phone} onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} />
          {passwordFields}
        </>}
      </div>

      <p className="signup-account-privacy">Your phone number is kept private on your Fixora profile. It is not verified during signup.</p>
      <Button className="signup-submit" loading={busy} type="submit" variant="primary" wide>{busy ? 'Creating account…' : <>Create {isProvider ? 'professional' : 'customer'} account<ArrowUpRight aria-hidden="true" size={20} weight="bold" /></>}</Button>
      {notice && <p aria-live="polite" className="signup-form__notice" role="status">{notice}</p>}
      {!authConfigured && <p className="signup-form__notice">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to connect account services.</p>}
      <Button as={Link} className="signup-form__signin" to="/auth/login" variant="secondary" wide>Already have an account? Sign in</Button>
    </form>
  )
}
