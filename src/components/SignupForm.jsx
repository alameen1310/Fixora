import { useState } from 'react'
import serviceCategories from '../data/serviceCategories.js'
import './SignupForm.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[+\d().\s-]+$/

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

function TextField({ autoComplete, error, hint, id, inputMode, label, name, onChange, required = true, showRequired = false, type = 'text', value }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`signup-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {showRequired && <span className="signup-field__required">Required</span>}
        {!required && <span className="signup-field__optional">Optional</span>}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={id}
        inputMode={inputMode}
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
  if (audience === 'provider' && values.serviceCategories.length === 0) errors.serviceCategories = 'Choose at least one service.'
  const phone = values.phone.trim()
  const phoneDigits = phone.replace(/\D/g, '')
  if (!phone) {
    errors.phone = 'Enter your phone number.'
  } else if (!phonePattern.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid phone number with 7 to 15 digits.'
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
    serviceCategories: [],
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

  function toggleServiceCategory(category, checked) {
    setValues((current) => ({
      ...current,
      serviceCategories: checked
        ? [...current.serviceCategories, category]
        : current.serviceCategories.filter((item) => item !== category),
    }))
    setErrors((current) => {
      if (!current.serviceCategories) return current
      const next = { ...current }
      delete next.serviceCategories
      return next
    })
    setNotice('')
  }

  const accountNameLabel = isProvider && values.accountType === 'business' ? 'Business name' : 'Full name'
  const accountNameAutoComplete = isProvider && values.accountType === 'business' ? 'organization' : 'name'
  const accountNameField = (
    <TextField
      autoComplete={accountNameAutoComplete}
      error={errors.accountName}
      id="account-name"
      label={accountNameLabel}
      name="accountName"
      onChange={(event) => update('accountName', event.target.value)}
      value={values.accountName}
    />
  )
  const emailField = (
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
  )
  const phoneField = (
    <TextField
      autoComplete="tel"
      error={errors.phone}
      id="phone"
      inputMode="tel"
      label="Phone number"
      name="phone"
      onChange={(event) => update('phone', event.target.value)}
      showRequired
      type="tel"
      value={values.phone}
    />
  )
  const passwordFields = (
    <>
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
    </>
  )
  const serviceCategoryField = isProvider && (
    <fieldset
      aria-describedby={errors.serviceCategories ? 'service-categories-error' : undefined}
      aria-invalid={Boolean(errors.serviceCategories)}
      className={`signup-category-fieldset signup-field${errors.serviceCategories ? ' has-error' : ''}`}
    >
      <legend>Services you offer <span className="signup-field__required">Required</span></legend>
      <div className="signup-category-options">
        {serviceCategories.map((category) => {
          const selected = values.serviceCategories.includes(category)
          return (
            <label className={selected ? 'is-selected' : ''} key={category}>
              <input
                checked={selected}
                name="serviceCategories"
                onChange={(event) => toggleServiceCategory(category, event.target.checked)}
                type="checkbox"
                value={category}
              />
              <span>{category}</span>
            </label>
          )
        })}
      </div>
      {errors.serviceCategories && <span className="signup-field__error" id="service-categories-error" role="alert">{errors.serviceCategories}</span>}
    </fieldset>
  )

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

      <div className={`signup-form__fields${isProvider ? ' signup-form__fields--provider' : ''}`}>
        {isProvider ? (
          <>
            <div className="signup-provider-name">{accountNameField}</div>
            <div className="signup-provider-contact">
              {emailField}
              {phoneField}
            </div>
            {serviceCategoryField}
            <div className="signup-provider-passwords">{passwordFields}</div>
          </>
        ) : (
          <>
            {accountNameField}
            {emailField}
            {phoneField}
            {passwordFields}
          </>
        )}
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
