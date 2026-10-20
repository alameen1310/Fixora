import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, MapPin, SignOut, User, Wrench } from '@phosphor-icons/react'
import PhoneNumberField, { countryOptions, getE164Phone } from '../components/PhoneNumberField.jsx'
import LoadingIndicator from '../components/LoadingIndicator.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { Logo } from '../components/UiPrimitives.jsx'
import AvatarUploader from '../components/AvatarUploader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { nigerianLocations } from '../lib/nigerianLocations.js'
import { supabase } from '../lib/supabase.js'
import './OnboardingPage.css'

const providerSteps = ['Contact details', 'Professional profile', 'Services', 'Service areas', 'Review', 'Add a profile photo']
const customerSteps = ['Contact details', 'Add a profile photo']
const stepContext = [
  { title: 'The right people can reach you.', description: 'Your name and private contact number help Fixora prepare your account. Your phone is not verified or shown publicly.', Icon: User },
  { title: 'Give your work a clear identity.', description: 'Tell customers what you do and what they can expect from your work.', Icon: User },
  { title: 'Show the work you take on.', description: 'Select the services that best match your skills. Customers can use them to understand where you fit.', Icon: Wrench },
  { title: 'Set the places you can serve.', description: 'Add the cities and regions where you take on work.', Icon: MapPin },
  { title: 'Review before you finish.', description: 'Check the information you have shared. Your profile is published only after the required setup is complete.', Icon: Check },
  { title: 'Make your profile easier to recognise.', description: 'A profile photo is optional. You can add it now or skip and come back later.', Icon: User },
]

async function requestWithTimeout(startRequest, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await startRequest(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

async function saveProviderProfile(userId, fields) {
  return requestWithTimeout(async (signal) => {
    const { data: existing, error: lookupError } = await supabase
      .from('provider_profiles')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle()
      .abortSignal(signal)
    if (lookupError) throw lookupError

    if (existing) {
      const { error } = await supabase
        .from('provider_profiles')
        .update(fields)
        .eq('profile_id', userId)
        .abortSignal(signal)
      if (error) throw error
      return
    }

    const { error: insertError } = await supabase
      .from('provider_profiles')
      .insert({ profile_id: userId, ...fields })
      .abortSignal(signal)
    if (!insertError) return
    if (insertError.code !== '23505') throw insertError

    // Another tab may have created this user's unique profile between the read and insert.
    const { data: racedProfile, error: raceLookupError } = await supabase
      .from('provider_profiles')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle()
      .abortSignal(signal)
    if (raceLookupError || !racedProfile) throw insertError

    const { error: updateError } = await supabase
      .from('provider_profiles')
      .update(fields)
      .eq('profile_id', userId)
      .abortSignal(signal)
    if (updateError) throw updateError
  })
}

export default function OnboardingPage({ audience }) {
  const isProvider = audience === 'provider'
  const navigate = useNavigate()
  const { user, profile, setProfile, signOut } = useAuth()
  const { showToast } = useToast()
  const [step, setStep] = useState(1)
  const [photoPath, setPhotoPath] = useState(profile?.avatar_path || '')
  const steps = isProvider ? providerSteps : customerSteps
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [editingContact, setEditingContact] = useState(false)
  const busyRef = useRef(false)
  const [values, setValues] = useState({
    fullName: profile?.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
    phone: profile?.phone_number ?? '',
    phoneCountry: 'NG',
    displayName: user?.user_metadata?.provider_display_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
    description: '',
    categoryIds: [],
    serviceAreas: [{ country_code: 'NG', region: '', city: '', state_code: '' }],
    nationwide: false,
  })

  useEffect(() => {
    if (!user) return undefined
    let alive = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    async function loadOnboarding() {
      setLoadingData(true)
      setLoadFailed(false)
      try {
        const [categoriesResult, providerResult, selectedResult, areasResult] = await Promise.all([
        isProvider
          ? supabase.from('service_categories').select('id, slug, name').order('name').abortSignal(controller.signal)
          : Promise.resolve({ data: [], error: null }),
        isProvider
          ? supabase.from('provider_profiles').select('display_name, service_description, avatar_path, is_nationwide').eq('profile_id', user.id).maybeSingle().abortSignal(controller.signal)
          : Promise.resolve({ data: null, error: null }),
        isProvider
          ? supabase.from('provider_service_categories').select('category_id').eq('provider_id', user.id).abortSignal(controller.signal)
          : Promise.resolve({ data: [], error: null }),
        isProvider
          ? supabase.from('provider_service_areas').select('country_code, region, city, state_code').eq('provider_id', user.id).order('created_at').abortSignal(controller.signal)
          : Promise.resolve({ data: [], error: null }),
      ])
        if (!alive) return
        const firstError = categoriesResult.error || providerResult.error || selectedResult.error || areasResult.error
        if (firstError) throw firstError
        const categoryList = categoriesResult.data ?? []
        setCategories(categoryList)
        const metadataCategories = Array.isArray(user.user_metadata?.service_categories)
          ? user.user_metadata.service_categories
          : []
        const preselected = categoryList
          .filter((item) => metadataCategories.some((name) => name.toLowerCase() === item.name.toLowerCase() || name.toLowerCase() === item.slug))
          .map((item) => item.id)
        const savedProvider = providerResult.data
        setPhotoPath(savedProvider?.avatar_path || profile?.avatar_path || '')
        const savedAreas = areasResult.data?.length ? areasResult.data : null
        setValues((current) => ({
          ...current,
          fullName: profile?.full_name ?? current.fullName,
          phone: profile?.phone_number ?? current.phone,
          displayName: savedProvider?.display_name ?? current.displayName,
          description: savedProvider?.service_description ?? current.description,
          categoryIds: selectedResult.data?.length
            ? selectedResult.data.map((item) => item.category_id)
            : preselected,
          serviceAreas: savedAreas ?? current.serviceAreas,
          nationwide: Boolean(savedProvider?.is_nationwide),
        }))
        if (isProvider) {
          let resumeStep = 1
          if (profile?.full_name && profile?.phone_number) resumeStep = 2
          if (savedProvider) resumeStep = 3
          if (selectedResult.data?.length) resumeStep = 4
          if (savedAreas) resumeStep = 5
          setStep(resumeStep)
        }
      } catch {
        if (alive) setLoadFailed(true)
      } finally {
        if (alive) setLoadingData(false)
      }
    }
    loadOnboarding()
    return () => { alive = false; clearTimeout(timeout); controller.abort() }
  }, [user, isProvider, profile?.full_name, profile?.phone_number, loadAttempt])

  const currentStep = step
  const progress = useMemo(() => steps.map((label, index) => ({ label, number: index + 1, complete: index + 1 < currentStep })), [currentStep])

  function update(field, value) {
    setValues((current) => {
      return { ...current, [field]: value }
    })
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      if (field === 'serviceAreas') {
        Object.keys(next).filter((key) => key.startsWith('area-')).forEach((key) => delete next[key])
      }
      return next
    })
  }

  function validatePersonal() {
    const errors = {}
    if (!values.fullName.trim()) errors.fullName = 'Enter your full name.'
    if (!getE164Phone(values.phone, values.phoneCountry)) errors.phone = 'Enter a valid phone number for the selected country.'
    return errors
  }

  async function savePersonal() {
    const phoneNumber = getE164Phone(values.phone, values.phoneCountry)
    const { error: saveError } = await requestWithTimeout((signal) => supabase.from('profiles').update({
      full_name: values.fullName.trim(),
      phone_number: phoneNumber,
    }).eq('id', user.id).abortSignal(signal))
    if (saveError) throw saveError
    return phoneNumber
  }

  async function next(event) {
    event?.preventDefault()
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setFieldErrors({})
    try {
      if (currentStep === 1) {
        const validation = validatePersonal()
        if (Object.keys(validation).length) {
          setFieldErrors(validation)
          return
        }
        const canReuseContact = Boolean(
          profile?.full_name === values.fullName.trim()
          && profile?.phone_number === getE164Phone(values.phone, values.phoneCountry)
          && !editingContact,
        )
        if (!canReuseContact) await savePersonal()
        if (isProvider) {
          showToast({ type: 'success', message: canReuseContact ? 'Your account contact details are ready.' : 'Contact details saved.' })
          setStep(2)
        } else {
          showToast({ type: 'success', message: canReuseContact ? 'Your account contact details are ready.' : 'Contact details saved.' })
          setStep(2)
        }
      } else if (!isProvider && currentStep === 2) {
        await complete()
      } else if (isProvider && currentStep === 2) {
        if (!values.displayName.trim()) {
          setFieldErrors({ displayName: 'Enter the name customers should see on your professional profile.' })
          return
        }
        await saveProviderProfile(user.id, {
          display_name: values.displayName.trim(),
          provider_type: 'individual',
          service_description: values.description.trim(),
        })
        removeSessionValue('fixora.providerType')
        showToast({ type: 'success', message: 'Your professional profile details are saved.' })
        setStep(3)
      } else if (currentStep === 3) {
        if (!values.categoryIds.length) {
          setFieldErrors({ categoryIds: 'Choose at least one service category.' })
          return
        }
        const { error: saveError } = await requestWithTimeout((signal) => supabase.rpc('replace_provider_service_categories', { requested_category_ids: values.categoryIds }).abortSignal(signal))
        if (saveError) throw saveError
        showToast({ type: 'success', message: 'Your services are saved.' })
        setStep(4)
      } else if (currentStep === 4) {
        const cleanAreas = values.serviceAreas.map((area) => ({
          country_code: area.country_code,
          region: area.region.trim(),
          city: area.city.trim(),
          state_code: area.state_code || nigerianLocations.find(([name]) => name.toLowerCase() === area.region.trim().toLowerCase())?.[1] || null,
        }))
        const areaErrors = {}
        if (!values.nationwide) cleanAreas.forEach((area, index) => {
          if (!area.region) areaErrors[`area-${index}-region`] = 'Choose a state or territory.'
          if (!area.city) areaErrors[`area-${index}-city`] = 'Enter a city or area.'
        })
        if (!values.nationwide && !cleanAreas.length) {
          setFieldErrors({ serviceAreas: 'Add at least one service area.' })
          return
        }
        if (Object.keys(areaErrors).length) {
          setFieldErrors(areaErrors)
          return
        }
        const { error: saveError } = await requestWithTimeout((signal) => supabase.rpc('replace_provider_service_areas', { requested_areas: values.nationwide ? [] : cleanAreas, requested_nationwide: values.nationwide }).abortSignal(signal))
        if (saveError) throw saveError
        showToast({ type: 'success', message: 'Your service areas are saved.' })
        setStep(5)
      } else if (isProvider && currentStep === 5) {
        setStep(6)
      } else {
        await complete()
      }
    } catch (saveError) {
      showToast({ type: 'error', duration: 0, message: formatOnboardingError(saveError) })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function complete() {
    const { data: completionTime, error: completionError } = await requestWithTimeout((signal) => supabase.rpc('complete_onboarding').abortSignal(signal))
    if (completionError) throw completionError
    setProfile((current) => current ? {
      ...current,
      full_name: values.fullName.trim(),
      phone_number: getE164Phone(values.phone, values.phoneCountry),
      onboarding_completed_at: completionTime ?? new Date().toISOString(),
    } : current)
    showToast({ type: 'success', message: 'Your Fixora setup is complete.' })
    navigate('/app', { replace: true })
  }

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch {
      showToast({ type: 'error', message: 'We couldn’t sign you out. Please try again.' })
    }
  }

  const context = !isProvider && currentStep === 2 ? stepContext[5] : stepContext[currentStep - 1]
  const ContextIcon = context.Icon
  const contactAlreadySaved = Boolean(profile?.full_name && profile?.phone_number)
  const contactIsComplete = Boolean(values.fullName.trim() && getE164Phone(values.phone, values.phoneCountry))
  const showContactSummary = !isProvider && contactAlreadySaved && contactIsComplete && !editingContact

  if (loadingData) return <LoadingOnboarding isProvider={isProvider} />

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Logo to="/" />
        <button className="onboarding-signout" onClick={handleSignOut} type="button">
          <SignOut aria-hidden="true" size={18} /> Sign out
        </button>
      </header>

      <div className="onboarding-layout">
        <aside aria-label="Your provider setup" className="onboarding-context">
          <div className="onboarding-context__art" aria-hidden="true">
            <span className="onboarding-context__orbit onboarding-context__orbit--one" />
            <span className="onboarding-context__orbit onboarding-context__orbit--two" />
            <span className="onboarding-context__home"><ContextIcon size={34} weight="duotone" /></span>
            <span className="onboarding-context__node onboarding-context__node--top"><Check size={16} weight="bold" /></span>
            <span className="onboarding-context__node onboarding-context__node--bottom"><Wrench size={16} weight="bold" /></span>
          </div>
          <div className="onboarding-context__copy">
            <p className="onboarding-context__eyebrow">Your Fixora profile</p>
            <h2>{context.title}</h2>
            <p>{context.description}</p>
          </div>
          <ol aria-label={isProvider ? 'Provider setup progress' : 'Account setup progress'} className="onboarding-context__steps">
            {progress.map(({ label, number, complete: isComplete }) => (
              <li aria-current={number === currentStep ? 'step' : undefined} className={number === currentStep ? 'is-current' : isComplete ? 'is-complete' : ''} key={label}>
                <span>{isComplete ? <Check aria-hidden="true" size={14} weight="bold" /> : number}</span>
                <small>{label}</small>
              </li>
            ))}
          </ol>
        </aside>

        <section aria-labelledby="onboarding-title" aria-busy={busy || loadingData} className="onboarding-card">
          <div className="onboarding-mobile-progress" aria-label={`Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1]}`}>
            <div className="onboarding-step-bars" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`onboarding-step-bar ${i + 1 < currentStep ? 'is-complete' : i + 1 === currentStep ? 'is-active' : ''}`}
                  />
                ))}
              </div>
            <div className="onboarding-step-meta">
              <span className="onboarding-step-count">Step {currentStep} of {steps.length}</span>
              <span className="onboarding-step-name">{steps[currentStep - 1]}</span>
            </div>
          </div>

          <p className="onboarding-kicker">Step {currentStep} of {steps.length}</p>
          <h1 id="onboarding-title">{steps[currentStep - 1]}</h1>
          <p className="onboarding-intro">{currentStep === 1
            ? 'Your name and contact number are saved with your account. Add or update them here if needed.'
            : currentStep === 2 && isProvider
              ? 'Create the professional profile customers will discover.'
              : currentStep === 3
                ? 'Choose the services that best reflect the work you take on.'
                : currentStep === 4
                  ? 'Add the cities and regions where you are available.'
                  : currentStep === 5
                    ? 'Review the details you have shared before finishing setup.'
                    : 'A profile photo is optional. You can add it now or skip and come back later.'}</p>

          {loadFailed ? (
            <div className="onboarding-load-error" role="alert">
              <h2>We couldn’t load your saved details.</h2>
              <p>Your current entries are still here. Check your connection and retry loading before continuing.</p>
              <button className="onboarding-secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">Try loading again</button>
            </div>
          ) : (
            <form className="onboarding-form" noValidate onSubmit={next}>
              {currentStep === 1 && (
                showContactSummary ? (
                  <div className="onboarding-contact-summary">
                    <dl>
                      <div><dt>Name</dt><dd>{values.fullName}</dd></div>
                      <div>
                        <dt>Phone</dt>
                        <dd>
                          {getE164Phone(values.phone, values.phoneCountry)}{' '}
                          <span className="onboarding-privacy-badge">Private</span>
                        </dd>
                      </div>
                    </dl>
                    <button className="onboarding-text-action" onClick={() => setEditingContact(true)} type="button">Edit contact details</button>
                  </div>
                ) : (
                  <div className="onboarding-contact-fields">
                    <Field error={fieldErrors.fullName} id="onboarding-full-name" label="Full name" onChange={(value) => update('fullName', value)} value={values.fullName} />
                    {user?.user_metadata?.name && !profile?.full_name && <p className="onboarding-hint">Suggested from your Google account; change it if needed. It isn’t identity verification.</p>}
                    <PhoneNumberField className="onboarding-phone-field" country={values.phoneCountry} error={fieldErrors.phone} onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} />
                    <p className="onboarding-hint">Your phone number is saved securely and privately with your account. It is never displayed publicly.</p>
                    {!isProvider && contactAlreadySaved && <button className="onboarding-text-action" onClick={() => setEditingContact(false)} type="button">Cancel editing</button>}
                  </div>
                )
              )}

              {currentStep === 2 && isProvider && (
                <>
                  <Field error={fieldErrors.displayName} id="provider-display-name" label="Display name" onChange={(value) => update('displayName', value)} value={values.displayName} />
                  <p className="onboarding-hint">The name customers see. Your own name or the name you work under.</p>
                  <label className="onboarding-field" htmlFor="provider-description"><span>Short description <em>Optional</em></span><textarea id="provider-description" maxLength={1000} onChange={(event) => update('description', event.target.value)} placeholder="What kinds of projects do you take on?" rows={4} value={values.description} /></label>
                </>
              )}

              {currentStep === 3 && (
                <fieldset aria-describedby={fieldErrors.categoryIds ? 'onboarding-categories-error' : undefined} aria-invalid={Boolean(fieldErrors.categoryIds)} className={`onboarding-categories${fieldErrors.categoryIds ? ' has-error' : ''}`}>
                  <legend>Services you offer</legend>
                  <p className="onboarding-sublegend">Select all that apply to your work.</p>
                  <div className="onboarding-category-grid">{categories.map((category) => {
                    const isSelected = values.categoryIds.includes(category.id)
                    return (
                      <label className={`onboarding-category-item ${isSelected ? 'is-selected' : ''}`} key={category.id}>
                        <input checked={isSelected} onChange={(event) => update('categoryIds', event.target.checked ? [...values.categoryIds, category.id] : values.categoryIds.filter((id) => id !== category.id))} type="checkbox" />
                        <span className="onboarding-category-check" aria-hidden="true">
                          {isSelected && <Check size={14} weight="bold" />}
                        </span>
                        <span className="onboarding-category-text">{category.name}</span>
                      </label>
                    )
                  })}</div>
                  {fieldErrors.categoryIds && <span className="onboarding-field-error" id="onboarding-categories-error" role="alert">{fieldErrors.categoryIds}</span>}
                </fieldset>
              )}

              {currentStep === 4 && (
                <div className="onboarding-areas">
                  {values.serviceAreas.map((area, index) => (
                    <div className="onboarding-area" key={`${index}-${area.country_code}`}>
                      <div className="onboarding-area-header">
                        <span className="onboarding-area-count">Area {index + 1}</span>
                        {values.serviceAreas.length > 1 && (
                          <button className="onboarding-remove-area" onClick={() => update('serviceAreas', values.serviceAreas.filter((_, areaIndex) => areaIndex !== index))} type="button">
                            Remove
                          </button>
                        )}
                      </div>
                      <label className="onboarding-field" htmlFor={`area-country-${index}`}>
                        <span>Country</span>
                        <select id={`area-country-${index}`} onChange={(event) => changeArea(index, 'country_code', event.target.value, values, update)} value={area.country_code}>
                          {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                        </select>
                      </label>
                      {area.country_code === 'NG' ? <label className="onboarding-field" htmlFor={`area-region-${index}`}><span>Nigerian state or territory</span><select id={`area-region-${index}`} onChange={(event) => changeStateArea(index, event.target.value, values, update)} value={area.state_code || nigerianLocations.find(([name]) => name.toLowerCase() === area.region.toLowerCase())?.[1] || (area.region ? `legacy:${area.region}` : '')}><option value="">Choose a state or territory</option>{nigerianLocations.map(([name, code]) => <option key={code} value={code}>{name}</option>)}{area.region && !nigerianLocations.some(([name]) => name.toLowerCase() === area.region.toLowerCase()) && <option value={`legacy:${area.region}`}>{area.region} (saved location)</option>}</select></label> : <Field error={fieldErrors[`area-${index}-region`]} id={`area-region-${index}`} label="State or region" onChange={(value) => changeArea(index, 'region', value, values, update)} value={area.region} placeholder="Enter a region" />}
                      <Field error={fieldErrors[`area-${index}-city`]} id={`area-city-${index}`} label="City" onChange={(value) => changeArea(index, 'city', value, values, update)} value={area.city} placeholder="e.g. Ikeja, Lekki, or Surulere" />
                    </div>
                  ))}
                  {!values.nationwide && <button className="onboarding-add-area" onClick={() => update('serviceAreas', [...values.serviceAreas, { country_code: 'NG', region: '', city: '', state_code: '' }])} type="button">
                    + Add another service area
                  </button>}
                  {values.nationwide && <p className="onboarding-hint">Your saved nationwide coverage is preserved. Add local areas only if you want to change it.</p>}
                  <p className="onboarding-hint">Only the country, region, and city are shown on your public professional profile.</p>
                </div>
              )}

              {currentStep === 5 && <Review values={values} categories={categories} />}
              {((!isProvider && currentStep === 2) || (isProvider && currentStep === 6)) && <AvatarUploader name={values.displayName || values.fullName} path={photoPath} provider={isProvider} onSaved={setPhotoPath} />}

              <div className="onboarding-actions">
                {isProvider && currentStep > 1 && currentStep <= 5 && (
                  <button className="onboarding-secondary" disabled={busy} onClick={() => setStep((current) => current - 1)} type="button">
                    <ArrowLeft aria-hidden="true" size={18} /> Back
                  </button>
                )}
                <button className="onboarding-primary" disabled={busy} type="submit">
                  {busy ? <><LoadingIndicator /> {currentStep === steps.length ? 'Finishing setup…' : 'Saving step…'}</> : currentStep === steps.length ? 'Finish setup' : 'Save and continue'}
                  {!busy && <ArrowRight aria-hidden="true" size={18} />}
                </button>
              </div>
              {currentStep === steps.length && <button className="onboarding-text-action onboarding-skip-photo" disabled={busy} onClick={() => void next()} type="button">Skip for now</button>}
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

function Field({ error, id, label, onChange, value }) {
  return (
    <label className={`onboarding-field${error ? ' has-error' : ''}`} htmlFor={id}>
      <span>{label}</span>
      <input aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} autoComplete={id.includes('name') ? 'name' : undefined} id={id} onChange={(event) => onChange(event.target.value)} required value={value} />
      {error && <small className="onboarding-field-error" id={`${id}-error`} role="alert">{error}</small>}
    </label>
  )
}

function LoadingOnboarding({ isProvider }) {
  return (
    <main className="onboarding-page onboarding-page--loading">
      <header className="onboarding-header">
        <Logo to="/" />
        <span className="onboarding-header__status">Account setup</span>
      </header>
      <div className="onboarding-layout" aria-busy="true">
        <aside className="onboarding-context onboarding-context--skeleton" aria-hidden="true"><span /><span /><span /></aside>
        <section className="onboarding-card onboarding-card--skeleton" aria-label="Loading your saved details">
          <p className="onboarding-kicker" role="status">Loading your saved setup…</p>
          {isProvider && <div className="onboarding-skeleton onboarding-skeleton--progress" />}
          <div className="onboarding-skeleton onboarding-skeleton--heading" />
          <div className="onboarding-skeleton onboarding-skeleton--copy" />
          <div className="onboarding-skeleton onboarding-skeleton--field" />
          <div className="onboarding-skeleton onboarding-skeleton--field" />
          <div className="onboarding-skeleton onboarding-skeleton--button" />
        </section>
      </div>
    </main>
  )
}

function changeArea(index, field, value, values, update) {
  update('serviceAreas', values.serviceAreas.map((area, areaIndex) => areaIndex === index ? { ...area, [field]: value } : area))
}

function changeStateArea(index, value, values, update) {
  if (value.startsWith('legacy:')) return
  const selected = nigerianLocations.find(([, code]) => code === value)
  update('serviceAreas', values.serviceAreas.map((area, areaIndex) => areaIndex === index ? { ...area, state_code: value, region: selected?.[0] || '' } : area))
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
    <div className="onboarding-review-card">
      <div className="onboarding-review-row">
        <span className="onboarding-review-label">Full name</span>
        <span className="onboarding-review-val">{values.fullName || 'Not added'}</span>
      </div>
      <div className="onboarding-review-row">
        <span className="onboarding-review-label">Phone number</span>
        <span className="onboarding-review-val">
          {getE164Phone(values.phone, values.phoneCountry) || 'Not added'}
          <span className="onboarding-privacy-badge">Private</span>
        </span>
      </div>
      <div className="onboarding-review-row">
        <span className="onboarding-review-label">Display name</span>
        <span className="onboarding-review-val">{values.displayName || 'Not added'}</span>
      </div>
      <div className="onboarding-review-row">
        <span className="onboarding-review-label">Services</span>
        <span className="onboarding-review-val">{selectedCategories.join(', ') || 'Not selected'}</span>
      </div>
      <div className="onboarding-review-row">
        <span className="onboarding-review-label">Service areas</span>
        <span className="onboarding-review-val">{values.serviceAreas.map((area) => [area.city, area.region, area.country_code].filter(Boolean).join(', ')).join(' · ') || 'Not added'}</span>
      </div>
    </div>
  )
}

function formatOnboardingError(error) {
  const message = error?.message ?? ''
  if (error?.name === 'AbortError' || /timed? ?out|aborted/i.test(message)) return 'This step took too long to save. Your entries are still here; check your connection and try again.'
  if (error?.code === '23505' || /duplicate key|unique constraint/i.test(message)) return 'That service area is listed more than once. Remove the duplicate and try again.'
  if (error?.code === '42501') return 'Fixora could not save this step because the database rejected the account permissions. Your entries are still here; please try again. If it continues, contact support.'
  if (error?.code === 'P0002' || /profile is not ready|provider account is required/i.test(message)) return 'Your account details are still being prepared. Please try again in a moment.'
  if (error?.code === '23514' || error?.code === '23502' || error?.code === '23503') return 'Some details do not meet the requirements. Review this step and try again.'
  if (error?.status >= 500) return 'Fixora is temporarily unavailable. Your entries are still here; please try again shortly.'
  if (/Choose at least one|Enter |Add /i.test(message)) return message
  return 'We couldn’t save this step. Your entries are still here; please try again. If the problem continues, contact support.'
}
