import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Eye, EyeSlash, GoogleLogo } from '@phosphor-icons/react'
import PhoneNumberField, { getE164Phone } from './PhoneNumberField.jsx'
import serviceCategories from '../data/serviceCategories.js'
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

function validate(values, audience) {
  const errors = {}
  if (!values.fullName.trim()) errors.fullName = 'Enter your full name.'
  if (audience === 'provider' && values.accountType === 'business' && !values.businessName.trim()) errors.businessName = 'Enter your business name.'
  if (!emailPattern.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (!getE164Phone(values.phone, values.phoneCountry)) errors.phone = 'Enter a valid phone number for the selected country.'
  if (audience === 'provider' && values.serviceCategories.length === 0) errors.serviceCategories = 'Choose at least one service.'
  if (values.password.length < 8) errors.password = 'Use at least 8 characters for your password.'
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

function formatSignupError(error) {
  if (/user already registered/i.test(error?.message ?? '')) return 'An account with this email already exists. Sign in instead.'
  if (/password/i.test(error?.message ?? '') && /weak|short|length/i.test(error.message)) return 'Choose a stronger password with at least 8 characters.'
  if (/rate limit/i.test(error?.message ?? '')) return 'Too many attempts. Please wait a little and try again.'
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
    accountType: 'individual',
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    phoneCountry: 'NG',
    serviceCategories: [],
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [visiblePasswords, setVisiblePasswords] = useState({ password: false, confirmPassword: false })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      if (field === 'password') delete next.confirmPassword
      if (field === 'accountType') delete next.businessName
      return next
    })
    setNotice('')
  }

  function toggleServiceCategory(category, checked) {
    setValues((current) => ({
      ...current,
      serviceCategories: checked
        ? [...current.serviceCategories, category]
        : current.serviceCategories.filter((item) => item !== category),
    }))
    setErrors((current) => {
      const next = { ...current }
      delete next.serviceCategories
      return next
    })
  }

  async function beginGoogleSignup() {
    if (!supabase) {
      setNotice('Account services are not configured yet. Add the Supabase environment variables to enable registration.')
      return
    }
    setBusy(true)
    try {
      sessionStorage.setItem('fixora.signupType', audience)
      if (isProvider) sessionStorage.setItem('fixora.providerType', values.accountType)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch {
      clearSignupIntent()
      setBusy(false)
      setNotice('Google sign-in could not start. Check that this browser allows site storage, then try again or continue with email.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values, audience)
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length) return
    if (!supabase) {
      setNotice('Account services are not configured yet. Add the Supabase environment variables to enable registration.')
      return
    }

    setBusy(true)
    try {
      const providerDisplayName = values.accountType === 'business' ? values.businessName.trim() : values.fullName.trim()
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: values.fullName.trim(),
            phone_number: getE164Phone(values.phone, values.phoneCountry),
            fixora_signup_type: audience,
            ...(isProvider ? {
              provider_type: values.accountType,
              provider_display_name: providerDisplayName,
              service_categories: values.serviceCategories,
            } : {}),
          },
        },
      })
      if (error) throw error
      if (data.session) {
        navigate('/auth/callback', { replace: true })
      } else {
        setNotice('Check your email for a confirmation link. After confirming, we’ll continue setting up your Fixora account.')
      }
    } catch (error) {
      setNotice(formatSignupError(error))
    } finally {
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
  const serviceCategoryField = isProvider && (
    <fieldset aria-describedby={errors.serviceCategories ? 'service-categories-error' : undefined} aria-invalid={Boolean(errors.serviceCategories)} className={`signup-category-fieldset signup-field${errors.serviceCategories ? ' has-error' : ''}`}>
      <legend>Services you offer <span className="signup-field__required">Required</span></legend>
      <div className="signup-category-options">
        {serviceCategories.map((category) => {
          const selected = values.serviceCategories.includes(category)
          return <label className={selected ? 'is-selected' : ''} key={category}><input checked={selected} name="serviceCategories" onChange={(event) => toggleServiceCategory(category, event.target.checked)} type="checkbox" value={category} /><span>{category}</span></label>
        })}
      </div>
      {errors.serviceCategories && <span className="signup-field__error" id="service-categories-error" role="alert">{errors.serviceCategories}</span>}
    </fieldset>
  )

  return (
    <form className="signup-form" data-signup-enter noValidate onSubmit={handleSubmit}>
      <div className="signup-form__section-heading">
        <h2>{isProvider ? 'Professional details' : 'Your details'}</h2>
        <p>{isProvider ? 'Create your account and begin building a professional profile.' : 'A few essentials to get your Fixora account started.'}</p>
      </div>
      {isProvider && <fieldset className="signup-account-type"><legend>Register as</legend>
        <label className={values.accountType === 'individual' ? 'is-selected' : ''}><input checked={values.accountType === 'individual'} name="accountType" onChange={() => update('accountType', 'individual')} type="radio" value="individual" /><span>Individual</span></label>
        <label className={values.accountType === 'business' ? 'is-selected' : ''}><input checked={values.accountType === 'business'} name="accountType" onChange={() => update('accountType', 'business')} type="radio" value="business" /><span>Business</span></label>
      </fieldset>}

      <button className="signup-google" disabled={busy} onClick={beginGoogleSignup} type="button"><GoogleLogo aria-hidden="true" size={20} weight="bold" /> Continue with Google</button>
      <div className={`signup-form__fields${isProvider ? ' signup-form__fields--provider' : ''}`}>
        {isProvider ? <>
          <div className="signup-provider-name">{nameField('fullName', 'Your full name', 'name')}{values.accountType === 'business' && nameField('businessName', 'Business name', 'organization')}</div>
          <div className="signup-provider-contact">
            {emailField}
            <PhoneNumberField country={values.phoneCountry} error={errors.phone} onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} />
          </div>
          {serviceCategoryField}
          <div className="signup-provider-passwords">{passwordFields}</div>
        </> : <>
          {nameField('fullName', 'Full name', 'name')}
          {emailField}
          <PhoneNumberField country={values.phoneCountry} error={errors.phone} onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} />
          {passwordFields}
        </>}
      </div>

      <p className="signup-account-privacy">Your phone number is kept private on your Fixora profile. It is not verified during signup.</p>
      <button className="signup-submit" disabled={busy} type="submit">{busy ? 'Creating account…' : `Create ${isProvider ? 'professional' : 'customer'} account`}<ArrowUpRight aria-hidden="true" size={20} weight="bold" /></button>
      {notice && <p aria-live="polite" className="signup-form__notice" role="status">{notice}</p>}
      {!authConfigured && <p className="signup-form__notice">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to connect account services.</p>}
      <p className="signup-form__signin">Already have an account? <Link to="/auth/login">Sign in</Link></p>
    </form>
  )
}
