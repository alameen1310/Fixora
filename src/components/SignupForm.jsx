import { useState } from 'react'
import serviceCategories from '../data/serviceCategories.js'
import './SignupForm.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[+()\d\s.-]{7,}$/

function PasswordField({ error, id, label, onChange, value, visible, onToggle, hint }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`signup-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="signup-password-control">
        <input
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          autoComplete="new-password"
          id={id}
          minLength={id === 'password' ? 8 : undefined}
          name={id}
          onChange={onChange}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          className="signup-password-toggle"
          onClick={onToggle}
          type="button"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <span className="signup-field__hint" id={hintId}>{hint}</span>}
      {error && <span className="signup-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}

function TextField({ autoComplete, error, hint, id, label, name, onChange, required = true, type = 'text', value }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`signup-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {!required && <span className="signup-field__optional">Optional</span>}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={id}
        name={name}
        onChange={onChange}
        required={required}
        type={type}
        value={value}
      />
      {hint && <span className="signup-field__hint" id={hintId}>{hint}</span>}
      {error && <span className="signup-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}

function validate(values, audience) {
  const errors = {}

  if (!values.accountName.trim()) {
    errors.accountName = audience === 'provider' && values.accountType === 'business'
      ? 'Enter your business name.'
      : 'Enter your full name.'
  }
  if (!emailPattern.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (audience === 'provider' && !values.serviceCategory) errors.serviceCategory = 'Choose your primary service.'
  if (audience === 'provider' && values.phone && !phonePattern.test(values.phone)) {
    errors.phone = 'Enter a valid phone number, or leave this optional field blank.'
  }
  if (values.password.length < 8) errors.password = 'Use at least 8 characters for your password.'
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.'
  if (!values.acknowledged) errors.acknowledged = 'Please confirm you understand how this signup preview works.'

  return errors
}

export default function SignupForm({ audience }) {
  const isProvider = audience === 'provider'
  const [values, setValues] = useState({
    accountType: 'individual',
    accountName: '',
    email: '',
    phone: '',
    serviceCategory: '',
    password: '',
    confirmPassword: '',
    acknowledged: false,
  })
  const [errors, setErrors] = useState({})
  const [visiblePasswords, setVisiblePasswords] = useState({ password: false, confirmPassword: false })
  const [notice, setNotice] = useState('')

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const dependentError = field === 'password' && current.confirmPassword
      const nameError = field === 'accountType' && current.accountName
      if (!current[field] && !dependentError && !nameError) return current
      const next = { ...current }
      delete next[field]
      if (dependentError || nameError) {
        delete next[field === 'password' ? 'confirmPassword' : 'accountName']
      }
      return next
    })
    setNotice('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(values, audience)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length) {
      setNotice('')
      return
    }

    setNotice('Signup is not connected yet. Your details have not been sent or saved.')
  }

  function togglePassword(field) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }))
  }

  const accountNameLabel = isProvider && values.accountType === 'business' ? 'Business name' : 'Full name'
  const accountNameAutoComplete = isProvider && values.accountType === 'business' ? 'organization' : 'name'

  return (
    <form className="signup-form" noValidate onSubmit={handleSubmit}>
      {isProvider && (
        <fieldset className="signup-account-type">
          <legend>Register as</legend>
          <label className={values.accountType === 'individual' ? 'is-selected' : ''}>
            <input
              checked={values.accountType === 'individual'}
              name="accountType"
              onChange={() => update('accountType', 'individual')}
              type="radio"
              value="individual"
            />
            <span>Individual</span>
          </label>
          <label className={values.accountType === 'business' ? 'is-selected' : ''}>
            <input
              checked={values.accountType === 'business'}
              name="accountType"
              onChange={() => update('accountType', 'business')}
              type="radio"
              value="business"
            />
            <span>Business</span>
          </label>
        </fieldset>
      )}

      <div className="signup-form__fields">
        <TextField
          autoComplete={accountNameAutoComplete}
          error={errors.accountName}
          id="account-name"
          label={accountNameLabel}
          name="accountName"
          onChange={(event) => update('accountName', event.target.value)}
          value={values.accountName}
        />
        {isProvider && (
          <div className={`signup-field${errors.serviceCategory ? ' has-error' : ''}`}>
            <label htmlFor="service-category">Primary service</label>
            <select
              aria-describedby={errors.serviceCategory ? 'service-category-error' : undefined}
              aria-invalid={Boolean(errors.serviceCategory)}
              id="service-category"
              name="serviceCategory"
              onChange={(event) => update('serviceCategory', event.target.value)}
              required
              value={values.serviceCategory}
            >
              <option disabled value="">Choose a service</option>
              {serviceCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            {errors.serviceCategory && <span className="signup-field__error" id="service-category-error" role="alert">{errors.serviceCategory}</span>}
          </div>
        )}
        <TextField
          autoComplete="email"
          error={errors.email}
          id="email"
          label="Email address"
          name="email"
          onChange={(event) => update('email', event.target.value)}
          type="email"
          value={values.email}
        />
        {isProvider && (
          <TextField
            autoComplete="tel"
            error={errors.phone}
            id="phone"
            label="Phone number"
            name="phone"
            onChange={(event) => update('phone', event.target.value)}
            required={false}
            type="tel"
            value={values.phone}
          />
        )}
        <PasswordField
          error={errors.password}
          hint="Use at least 8 characters."
          id="password"
          label="Password"
          onChange={(event) => update('password', event.target.value)}
          onToggle={() => togglePassword('password')}
          value={values.password}
          visible={visiblePasswords.password}
        />
        <PasswordField
          error={errors.confirmPassword}
          id="confirm-password"
          label="Confirm password"
          onChange={(event) => update('confirmPassword', event.target.value)}
          onToggle={() => togglePassword('confirmPassword')}
          value={values.confirmPassword}
          visible={visiblePasswords.confirmPassword}
        />
      </div>

      <div className={`signup-acknowledgement${errors.acknowledged ? ' has-error' : ''}`}>
        <label htmlFor={`${audience}-acknowledged`}>
          <input
            aria-describedby={errors.acknowledged ? `${audience}-acknowledged-error` : undefined}
            aria-invalid={Boolean(errors.acknowledged)}
            checked={values.acknowledged}
            id={`${audience}-acknowledged`}
            onChange={(event) => update('acknowledged', event.target.checked)}
            required
            type="checkbox"
          />
          <span>I understand that Fixora is still in development, my details will not be sent or saved, and terms and privacy information will be provided before registration opens.</span>
        </label>
        {errors.acknowledged && <span className="signup-field__error" id={`${audience}-acknowledged-error`} role="alert">{errors.acknowledged}</span>}
      </div>

      <button className="signup-submit" type="submit">
        Create {isProvider ? 'professional' : 'customer'} account
        <span aria-hidden="true">↗</span>
      </button>

      {notice && <p aria-live="polite" className="signup-form__notice" role="status">{notice}</p>}

      <p className="signup-form__signin">
        Already have an account? <span>Sign-in will be available when accounts are connected.</span>
      </p>
    </form>
  )
}
