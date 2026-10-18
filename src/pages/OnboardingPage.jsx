import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, SignOut } from '@phosphor-icons/react'
import PhoneNumberField, { countryOptions, getE164Phone } from '../components/PhoneNumberField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import './OnboardingPage.css'

const steps = ['Your details', 'Professional profile', 'Services', 'Service areas', 'Review']

export default function OnboardingPage({ audience }) {
  const isProvider = audience === 'provider'
  const navigate = useNavigate()
  const { user, profile, refreshProfile, setProfile } = useAuth()
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [values, setValues] = useState({
    fullName: profile?.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
    phone: profile?.phone_number ?? '',
    phoneCountry: 'NG',
    displayName: user?.user_metadata?.provider_display_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
    providerType: user?.user_metadata?.provider_type === 'business' || getSessionValue('fixora.providerType') === 'business' ? 'business' : 'individual',
    description: '',
    categoryIds: [],
    serviceAreas: [{ country_code: 'NG', region: '', city: '' }],
  })

  useEffect(() => {
    if (!user) return undefined
    let alive = true
    async function loadOnboarding() {
      setLoadingData(true)
      const categoriesQuery = supabase.from('service_categories').select('id, slug, name').order('name')
      const [categoriesResult, providerResult, selectedResult, areasResult] = await Promise.all([
        categoriesQuery,
        isProvider
          ? supabase.from('provider_profiles').select('display_name, provider_type, service_description').eq('profile_id', user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        isProvider
          ? supabase.from('provider_service_categories').select('category_id').eq('provider_id', user.id)
          : Promise.resolve({ data: [], error: null }),
        isProvider
          ? supabase.from('provider_service_areas').select('country_code, region, city').eq('provider_id', user.id).order('created_at')
          : Promise.resolve({ data: [], error: null }),
      ])
      if (!alive) return
      const firstError = categoriesResult.error || providerResult.error || selectedResult.error || areasResult.error
      if (firstError) {
        setError('We couldn’t load your saved onboarding details. Please retry.')
        setLoadingData(false)
        return
      }
      const categoryList = categoriesResult.data ?? []
      setCategories(categoryList)
      const metadataCategories = Array.isArray(user.user_metadata?.service_categories)
        ? user.user_metadata.service_categories
        : []
      const preselected = categoryList
        .filter((item) => metadataCategories.some((name) => name.toLowerCase() === item.name.toLowerCase() || name.toLowerCase() === item.slug))
        .map((item) => item.id)
      const savedProvider = providerResult.data
      const savedAreas = areasResult.data?.length ? areasResult.data : null
      setValues((current) => ({
        ...current,
        fullName: profile?.full_name ?? current.fullName,
        phone: profile?.phone_number ?? current.phone,
        displayName: savedProvider?.display_name ?? current.displayName,
        providerType: savedProvider?.provider_type ?? current.providerType,
        description: savedProvider?.service_description ?? current.description,
        categoryIds: selectedResult.data?.length
          ? selectedResult.data.map((item) => item.category_id)
          : preselected,
        serviceAreas: savedAreas ?? current.serviceAreas,
      }))
      if (isProvider) {
        if (profile?.full_name && profile?.phone_number) setStep(2)
        if (savedProvider) setStep(3)
        if (selectedResult.data?.length) setStep(4)
        if (savedAreas) setStep(5)
      }
      setLoadingData(false)
    }
    loadOnboarding().catch(() => {
      if (alive) {
        setError('We couldn’t load your saved onboarding details. Please retry.')
        setLoadingData(false)
      }
    })
    return () => { alive = false }
  }, [user, isProvider, profile?.full_name, profile?.phone_number])

  const currentStep = isProvider ? step : 1
  const progress = useMemo(() => steps.map((label, index) => ({ label, number: index + 1, complete: index + 1 < currentStep })), [currentStep])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function validatePersonal() {
    if (!values.fullName.trim()) return 'Enter your full name.'
    if (!getE164Phone(values.phone, values.phoneCountry)) return 'Enter a valid phone number for the selected country.'
    return ''
  }

  async function savePersonal() {
    const validation = validatePersonal()
    if (validation) throw new Error(validation)
    const { error: saveError } = await supabase.from('profiles').update({
      full_name: values.fullName.trim(),
      phone_number: getE164Phone(values.phone, values.phoneCountry),
    }).eq('id', user.id)
    if (saveError) throw saveError
    const { error: profileError } = await refreshProfile()
    if (profileError) throw profileError
  }

  async function next() {
    setBusy(true)
    setError('')
    try {
      if (currentStep === 1) {
        await savePersonal()
        if (isProvider) setStep(2)
        else await complete()
      } else if (currentStep === 2) {
        if (!values.displayName.trim()) throw new Error('Enter the name customers should see on your professional profile.')
        const { error: saveError } = await supabase.from('provider_profiles').upsert({
          profile_id: user.id,
          display_name: values.displayName.trim(),
          provider_type: values.providerType,
          service_description: values.description.trim(),
        }, { onConflict: 'profile_id' })
        if (saveError) throw saveError
        removeSessionValue('fixora.providerType')
        setStep(3)
      } else if (currentStep === 3) {
        if (!values.categoryIds.length) throw new Error('Choose at least one service category.')
        const { error: saveError } = await supabase.rpc('replace_provider_service_categories', { requested_category_ids: values.categoryIds })
        if (saveError) throw saveError
        setStep(4)
      } else if (currentStep === 4) {
        const cleanAreas = values.serviceAreas.map((area) => ({
          country_code: area.country_code,
          region: area.region.trim(),
          city: area.city.trim(),
        }))
        if (!cleanAreas.length || cleanAreas.some((area) => !area.country_code || !area.region || !area.city)) {
          throw new Error('Add a country, region, and city for every service area.')
        }
        const { error: saveError } = await supabase.rpc('replace_provider_service_areas', { requested_areas: cleanAreas })
        if (saveError) throw saveError
        setStep(5)
      } else {
        await complete()
      }
    } catch (saveError) {
      setError(formatOnboardingError(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function complete() {
    const { data: completionTime, error: completionError } = await supabase.rpc('complete_onboarding')
    if (completionError) throw completionError
    setProfile((current) => current ? { ...current, onboarding_completed_at: completionTime ?? new Date().toISOString() } : current)
    navigate('/app', { replace: true })
  }

  async function signOut() {
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      navigate('/', { replace: true })
    } catch {
      setError('We couldn’t sign you out. Please try again.')
    }
  }

  if (loadingData) return <main className="onboarding-page"><p role="status">Loading your saved details…</p></main>

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link aria-label="Return to Fixora home" className="onboarding-brand" to="/"><span>fixora</span></Link>
        <button className="onboarding-signout" onClick={signOut} type="button"><SignOut aria-hidden="true" size={18} /> Sign out</button>
      </header>
      <section aria-labelledby="onboarding-title" className="onboarding-card">
        {isProvider && (
          <ol aria-label="Provider setup progress" className="onboarding-progress">
            {progress.map(({ label, number, complete: isComplete }) => (
              <li aria-current={number === currentStep ? 'step' : undefined} className={number === currentStep ? 'is-current' : isComplete ? 'is-complete' : ''} key={label}>
                <span>{isComplete ? <Check aria-hidden="true" size={15} weight="bold" /> : number}</span><small>{label}</small>
              </li>
            ))}
          </ol>
        )}

        <p className="onboarding-kicker">{isProvider ? `Step ${currentStep} of 5` : 'One quick step'}</p>
        <h1 id="onboarding-title">{isProvider ? steps[currentStep - 1] : 'A little about you.'}</h1>
        <p className="onboarding-intro">
          {currentStep === 1
            ? 'Keep your details up to date so Fixora can support your account.'
            : currentStep === 2
              ? 'Set up the professional profile customers will discover.'
              : currentStep === 3
                ? 'Choose every service that matches the work you take on.'
                : currentStep === 4
                  ? 'Add the cities and regions where you are available.'
                  : 'Review your details. You can go back to edit any step.'}
        </p>

        <form className="onboarding-form" noValidate onSubmit={(event) => { event.preventDefault(); next() }}>
          {currentStep === 1 && (
            <>
              <Field id="onboarding-full-name" label="Full name" onChange={(value) => update('fullName', value)} value={values.fullName} />
              {user?.user_metadata?.name && <p className="onboarding-hint">Suggested from your Google account; you can change it here. It isn’t identity verification.</p>}
              <PhoneNumberField country={values.phoneCountry} error={error.includes('phone number') ? error : ''} onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} />
              <p className="onboarding-hint">Your phone number is saved privately and has not been verified.</p>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="onboarding-choice">
                <span>Profile type</span>
                <label><input checked={values.providerType === 'individual'} name="providerType" onChange={() => update('providerType', 'individual')} type="radio" /> Individual</label>
                <label><input checked={values.providerType === 'business'} name="providerType" onChange={() => update('providerType', 'business')} type="radio" /> Business</label>
              </div>
              <Field id="provider-display-name" label={values.providerType === 'business' ? 'Business name' : 'Professional name'} onChange={(value) => update('displayName', value)} value={values.displayName} />
              <label className="onboarding-field" htmlFor="provider-description"><span>Short description <em>Optional</em></span><textarea id="provider-description" maxLength={1000} onChange={(event) => update('description', event.target.value)} placeholder="What kinds of projects do you take on?" rows={4} value={values.description} /></label>
            </>
          )}

          {currentStep === 3 && (
            <fieldset className="onboarding-categories">
              <legend>Services you offer</legend>
              <div>{categories.map((category) => (
                <label className={values.categoryIds.includes(category.id) ? 'is-selected' : ''} key={category.id}>
                  <input checked={values.categoryIds.includes(category.id)} onChange={(event) => update('categoryIds', event.target.checked ? [...values.categoryIds, category.id] : values.categoryIds.filter((id) => id !== category.id))} type="checkbox" />
                  <span>{category.name}</span>
                </label>
              ))}</div>
            </fieldset>
          )}

          {currentStep === 4 && (
            <div className="onboarding-areas">
              {values.serviceAreas.map((area, index) => (
                <div className="onboarding-area" key={`${index}-${area.country_code}`}>
                  <label className="onboarding-field" htmlFor={`area-country-${index}`}>
                    <span>Country</span>
                    <select id={`area-country-${index}`} onChange={(event) => changeArea(index, 'country_code', event.target.value, values, update)} value={area.country_code}>
                      {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                    </select>
                  </label>
                  <Field id={`area-region-${index}`} label="State or region" onChange={(value) => changeArea(index, 'region', value, values, update)} value={area.region} />
                  <Field id={`area-city-${index}`} label="City" onChange={(value) => changeArea(index, 'city', value, values, update)} value={area.city} />
                  {values.serviceAreas.length > 1 && <button className="onboarding-remove-area" onClick={() => update('serviceAreas', values.serviceAreas.filter((_, areaIndex) => areaIndex !== index))} type="button">Remove area</button>}
                </div>
              ))}
              <button className="onboarding-add-area" onClick={() => update('serviceAreas', [...values.serviceAreas, { country_code: 'NG', region: '', city: '' }])} type="button">Add another service area</button>
              <p className="onboarding-hint">Only the country, region, and city are shown on your public professional profile.</p>
            </div>
          )}

          {currentStep === 5 && <Review values={values} categories={categories} />}

          {error && <p className="onboarding-error" role="alert">{error}</p>}
          <div className="onboarding-actions">
            {isProvider && currentStep > 1 && <button className="onboarding-secondary" disabled={busy} onClick={() => { setError(''); setStep((current) => current - 1) }} type="button"><ArrowLeft aria-hidden="true" size={18} /> Back</button>}
            <button className="onboarding-primary" disabled={busy} type="submit">{busy ? 'Saving…' : currentStep === (isProvider ? 5 : 1) ? 'Finish setup' : 'Save and continue'}<ArrowRight aria-hidden="true" size={18} /></button>
          </div>
        </form>
      </section>
    </main>
  )
}

function Field({ id, label, onChange, value }) {
  return <label className="onboarding-field" htmlFor={id}><span>{label}</span><input autoComplete={id.includes('name') ? 'name' : undefined} id={id} onChange={(event) => onChange(event.target.value)} required value={value} /></label>
}

function changeArea(index, field, value, values, update) {
  update('serviceAreas', values.serviceAreas.map((area, areaIndex) => areaIndex === index ? { ...area, [field]: value } : area))
}

function getSessionValue(key) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function removeSessionValue(key) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Persisted Auth metadata remains available when browser storage is blocked.
  }
}

function Review({ values, categories }) {
  const selectedCategories = categories.filter((category) => values.categoryIds.includes(category.id)).map((category) => category.name)
  return (
    <dl className="onboarding-review">
      <div><dt>Full name</dt><dd>{values.fullName || 'Not added'}</dd></div>
      <div><dt>Phone number</dt><dd>{getE164Phone(values.phone, values.phoneCountry) || 'Not added'} <small>Not verified</small></dd></div>
      <div><dt>{values.providerType === 'business' ? 'Business name' : 'Professional name'}</dt><dd>{values.displayName || 'Not added'}</dd></div>
      <div><dt>Services</dt><dd>{selectedCategories.join(', ') || 'Not selected'}</dd></div>
      <div><dt>Service areas</dt><dd>{values.serviceAreas.map((area) => [area.city, area.region, area.country_code].filter(Boolean).join(', ')).join(' · ') || 'Not added'}</dd></div>
    </dl>
  )
}

function formatOnboardingError(error) {
  if (/duplicate key|unique constraint/i.test(error?.message ?? '')) return 'That service area is listed more than once. Remove the duplicate and try again.'
  if (/profile is not ready|provider account is required/i.test(error?.message ?? '')) return 'Your account details are still being prepared. Please try again.'
  return error?.message?.includes('Choose at least one') || error?.message?.includes('Enter ') || error?.message?.includes('Add ') 
    ? error.message
    : 'We couldn’t save that step. Please check your connection and try again.'
}
