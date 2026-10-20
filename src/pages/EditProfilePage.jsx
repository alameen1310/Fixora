import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Plus, X } from '@phosphor-icons/react'
import { Link, useNavigate } from 'react-router-dom'
import AvatarUploader from '../components/AvatarUploader.jsx'
import PhoneNumberField, { getE164Phone } from '../components/PhoneNumberField.jsx'
import { Button } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { nigerianLocations } from '../lib/nigerianLocations.js'
import { supabase } from '../lib/supabase.js'
import './AuthenticatedPages.css'
import './EditProfilePage.css'

const providerColumns = 'profile_id, display_name, provider_type, service_description, avatar_path, availability, is_nationwide, provider_service_categories(category_id), provider_service_areas(country_code, region, city, state_code)'

export default function EditProfilePage() {
  const { user, profile, setProfile } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [values, setValues] = useState({ fullName: '', phone: '', phoneCountry: 'NG', region: '', city: '', displayName: '', description: '', providerType: 'individual', availability: 'available', nationwide: false, categoryIds: [], areas: [] })
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_path || '')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try {
        const jobs = [supabase.from('profiles').select('full_name, phone_number, location_region, location_city, avatar_path').eq('id', user.id).maybeSingle()]
        if (isProvider) {
          jobs.push(supabase.from('provider_profiles').select(providerColumns).eq('profile_id', user.id).maybeSingle())
          jobs.push(supabase.from('service_categories').select('id, name, slug').order('name'))
        }
        const results = await Promise.all(jobs)
        for (const result of results) if (result.error) throw result.error
        if (!active) return
        const basics = results[0].data || {}
        const provider = isProvider ? results[1].data : null
        setAvatarPath(provider?.avatar_path || basics.avatar_path || '')
        setCategories(isProvider ? results[2].data || [] : [])
        setValues({
          fullName: basics.full_name || '', phone: basics.phone_number || '', phoneCountry: 'NG', region: basics.location_region || '', city: basics.location_city || '',
          displayName: provider?.display_name || basics.full_name || '', description: provider?.service_description || '', providerType: provider?.provider_type || 'individual',
          availability: provider?.availability || 'available', nationwide: Boolean(provider?.is_nationwide),
          categoryIds: (provider?.provider_service_categories || []).map((row) => row.category_id),
          areas: (provider?.provider_service_areas || []).map((area) => ({ country_code: area.country_code, region: area.region, city: area.city, state_code: area.state_code || '' })),
        })
      } catch (loadError) {
        console.error('[profile-edit-load]', { userId: user.id, code: loadError?.code, message: loadError?.message })
        if (active) setError('Your profile details could not load. Check your connection and try again.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [isProvider, user.id])

  function update(key, value) { setDirty(true); setValues((current) => ({ ...current, [key]: value })) }
  function updateArea(index, key, value) {
    const selected = key === 'state_code' ? nigerianLocations.find(([, code]) => code === value) : null
    update('areas', values.areas.map((area, i) => i === index ? { ...area, [key]: value, ...(selected ? { region: selected[0] } : {}) } : area))
  }
  function changeProviderType(type) {
    if (type === values.providerType) return
    if (!window.confirm(`Change this account to ${type === 'business' ? 'Service business' : 'Independent professional'}? This changes the name label shown on your public profile.`)) return
    update('providerType', type)
    if (type === 'individual' && values.nationwide) update('nationwide', false)
  }
  function beforeLeave(event) {
    if (dirty && !window.confirm('You have unsaved profile changes. Leave without saving?')) event.preventDefault()
  }

  async function save(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    const phone = values.phone ? getE164Phone(values.phone, values.phoneCountry) : null
    if (!values.fullName.trim()) { setError('Enter your name.'); return }
    if (values.phone && !phone) { setError('Enter a valid phone number. It stays private and is not verified.'); return }
    if (isProvider && !values.displayName.trim()) { setError(values.providerType === 'business' ? 'Enter your business name.' : 'Enter your professional name.'); return }
    if (isProvider && values.description.length > 600) { setError('Keep your service description to 600 characters or fewer.'); return }
    if (isProvider && !values.nationwide && !values.areas.some((area) => area.region.trim() && area.city.trim())) { setError('Add a state and city, or choose Nationwide for your business.'); return }
    if (isProvider && !values.categoryIds.length) { setError('Choose at least one service.'); return }
    setBusy(true)
    try {
      if (isProvider) {
        const areaPayload = values.nationwide ? [] : values.areas.filter((area) => area.region.trim() && area.city.trim()).map((area) => ({ country_code: 'NG', region: area.region.trim(), city: area.city.trim(), state_code: area.state_code || nigerianLocations.find(([name]) => name.toLowerCase() === area.region.toLowerCase())?.[1] || null }))
        const { error: areaError } = await supabase.rpc('replace_provider_service_areas', { requested_areas: areaPayload, requested_nationwide: values.nationwide })
        if (areaError) throw areaError
        const { error: categoryError } = await supabase.rpc('replace_provider_service_categories', { requested_category_ids: values.categoryIds })
        if (categoryError) throw categoryError
        const { error: providerError } = await supabase.from('provider_profiles').update({ display_name: values.displayName.trim(), service_description: values.description.trim(), provider_type: values.providerType, availability: values.availability }).eq('profile_id', user.id)
        if (providerError) throw providerError
      }
      const { error: profileError } = await supabase.from('profiles').update({ full_name: values.fullName.trim(), phone_number: phone, location_region: isProvider ? null : values.region || null, location_city: isProvider ? null : values.city.trim() || null }).eq('id', user.id)
      if (profileError) throw profileError
      setProfile((current) => ({ ...current, full_name: values.fullName.trim(), phone_number: phone, location_region: isProvider ? null : values.region || null, location_city: isProvider ? null : values.city.trim() || null }))
      setDirty(false)
      showToast({ type: 'success', message: 'Profile saved.' })
      navigate('/app/profile', { replace: true })
    } catch (saveError) {
      console.error('[profile-edit-save]', { userId: user.id, code: saveError?.code, message: saveError?.message })
      setError(/nationwide/i.test(saveError?.message || '') ? 'Only a service business can offer Nationwide coverage.' : 'Your profile could not be saved. Check your details and try again.')
    } finally { setBusy(false) }
  }

  if (loading) return <main className="app-page edit-profile-page"><p role="status">Loading your profile…</p></main>
  return <main className="app-page edit-profile-page">
    <header className="edit-profile-page__header"><Link aria-label="Back to profile" onClick={beforeLeave} to="/app/profile"><ArrowLeft size={19} />Profile</Link><div><h1>Edit profile</h1><p>Keep your details current so people know who they’re working with.</p></div></header>
    {error && <p className="edit-profile-page__error" role="alert">{error}</p>}
    <form className="edit-profile-grid" onSubmit={save}>
      <div className="edit-profile-main">
        <AvatarUploader name={values.fullName || values.displayName} path={avatarPath} provider={isProvider} onSaved={setAvatarPath} />
        <section className="edit-profile-section"><h2>Basics</h2><label className="edit-profile-field">Full name<input autoComplete="name" maxLength={120} onChange={(event) => update('fullName', event.target.value)} required value={values.fullName} /></label><PhoneNumberField country={values.phoneCountry} hint="Kept private. Not verified." onChange={(value) => update('phone', value)} onCountryChange={(value) => update('phoneCountry', value)} value={values.phone} /><p className="edit-profile-note">Email address: {user.email || 'Not available'} (managed by your sign-in provider)</p></section>
        {isProvider ? <>
          <section className="edit-profile-section"><h2>Professional account</h2><div className="edit-profile-choice"><button aria-pressed={values.providerType === 'individual'} onClick={() => changeProviderType('individual')} type="button">Independent professional</button><button aria-pressed={values.providerType === 'business'} onClick={() => changeProviderType('business')} type="button">Service business</button></div><label className="edit-profile-field">{values.providerType === 'business' ? 'Business name' : 'Professional name'}<input maxLength={120} onChange={(event) => update('displayName', event.target.value)} required value={values.displayName} /></label><label className="edit-profile-field">About your services<textarea maxLength={600} onChange={(event) => update('description', event.target.value)} rows={4} value={values.description} /></label><small className="edit-profile-note">{values.description.length}/600 characters</small><label className="edit-profile-field">Availability<select onChange={(event) => update('availability', event.target.value)} value={values.availability}><option value="available">Available</option><option value="busy">Busy</option></select></label></section>
          <section className="edit-profile-section"><h2>Services</h2><div className="edit-profile-chips">{categories.map((category) => <button aria-pressed={values.categoryIds.includes(category.id)} key={category.id} onClick={() => update('categoryIds', values.categoryIds.includes(category.id) ? values.categoryIds.filter((id) => id !== category.id) : [...values.categoryIds, category.id])} type="button">{values.categoryIds.includes(category.id) && <Check size={15} />}{category.name}</button>)}</div></section>
          <section className="edit-profile-section"><div className="edit-profile-section__head"><h2>Service areas</h2>{values.providerType === 'business' && <label><input checked={values.nationwide} onChange={(event) => update('nationwide', event.target.checked)} type="checkbox" />Nationwide</label>}</div>{values.nationwide ? <p className="edit-profile-note">Your business will appear for customers in every Nigerian state.</p> : <>{values.areas.map((area, index) => <div className="edit-profile-area" key={index}><label className="edit-profile-field">State or territory<select onChange={(event) => updateArea(index, 'state_code', event.target.value)} value={area.state_code || nigerianLocations.find(([, code]) => code === area.state_code)?.[1] || ''}><option value="">Choose a state</option>{nigerianLocations.map(([name, code]) => <option key={code} value={code}>{name}</option>)}{area.region && !nigerianLocations.some(([name]) => name.toLowerCase() === area.region.toLowerCase()) && <option value="">{area.region} (saved location)</option>}</select></label><label className="edit-profile-field">City or area<input maxLength={100} onChange={(event) => updateArea(index, 'city', event.target.value)} value={area.city} /></label>{values.areas.length > 1 && <button aria-label="Remove service area" className="edit-profile-area__remove" onClick={() => update('areas', values.areas.filter((_, i) => i !== index))} type="button"><X size={18} /></button>}</div>)}<button className="edit-profile-add" onClick={() => update('areas', [...values.areas, { country_code: 'NG', region: '', city: '', state_code: '' }])} type="button"><Plus size={17} />Add service area</button></>}</section>
        </> : <section className="edit-profile-section"><h2>Location</h2><label className="edit-profile-field">State or territory<select onChange={(event) => update('region', event.target.value)} value={values.region}><option value="">Choose a state</option>{nigerianLocations.map(([name]) => <option key={name} value={name}>{name}</option>)}{values.region && !nigerianLocations.some(([name]) => name === values.region) && <option value={values.region}>{values.region} (saved location)</option>}</select></label><label className="edit-profile-field">City or area<input maxLength={100} onChange={(event) => update('city', event.target.value)} value={values.city} /></label></section>}
        <div className="edit-profile-actions"><Button as={Link} onClick={beforeLeave} to="/app/profile" variant="secondary">Cancel</Button><Button disabled={busy} loading={busy} type="submit">Save changes</Button></div>
      </div>
    </form>
  </main>
}
