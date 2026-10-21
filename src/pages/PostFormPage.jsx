import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Image as ImageIcon, MapPin, X } from '@phosphor-icons/react'
import { Button, Chip, InputField, SegmentedControl, SelectField, Skeleton } from '../components/UiPrimitives.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import OverlayPortal from '../components/OverlayPortal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { describePhotoError, getPostImageUrl, logPostStep, preparePostPhoto } from '../lib/postImages.js'
import { nigerianLocations } from '../lib/nigerianLocations.js'
import { invalidatePostListCaches } from '../lib/postListCache.js'
import { supabase } from '../lib/supabase.js'
import './AuthenticatedPages.css'
import '../components/Posts.css'
import './PostFormPage.css'

const blank = { title: '', description: '', category_id: '', budget_type: 'open_to_quotes', min: '', max: '', negotiable: false, region: '', city: '', timing: 'flexible', target_date: '', schedule_mode: 'flexible', scheduled_start_at: '', scheduled_end_at: '', job_type: 'repair' }
const budgetOptions = [{ value: 'fixed', label: 'Fixed' }, { value: 'range', label: 'Range' }, { value: 'open_to_quotes', label: 'Open to quotes' }]
const timings = [['urgent', 'Urgent'], ['this_week', 'This week'], ['flexible', 'Flexible'], ['specific_date', 'Pick a date']]
const jobTypes = [['repair', 'Repair'], ['installation', 'Installation'], ['maintenance', 'Maintenance'], ['new_project', 'New project']]
const editColumns = 'id, author_id, category_id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, schedule_mode, scheduled_start_at, scheduled_end_at, job_type, status, published_at, hired_professional_id, problem_post_images(storage_path, sort_order, kind)'
const suggestedCities = ['Ikeja', 'Lekki', 'Yaba', 'Surulere', 'Ikoyi', 'Victoria Island', 'Ajah', 'Ejigbo', 'Festac', 'Maryland']

function defaultSchedule() {
  const nowWAT = new Date(Date.now() + 60 * 60 * 1000)
  const start = new Date(Date.UTC(nowWAT.getUTCFullYear(), nowWAT.getUTCMonth(), nowWAT.getUTCDate() + 1, 9))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const toInput = (date) => date.toISOString().slice(0, 16)
  return { start: toInput(start), end: toInput(end), date: start.toISOString().slice(0, 10) }
}

function toLagosInput(value) {
  if (!value) return ''
  return new Date(new Date(value).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
}

function fromLagosInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '')
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour - 1, minute)).toISOString()
}

function errorText(error, step) {
  const message = error?.message || ''
  if (error?.photoNumber) return `Photo ${error.photoNumber} failed: ${describePhotoError(error)}. Check your connection and retry.`
  if (message.includes('Unpublished post limit reached')) return 'You have reached the draft limit. Remove an unfinished post before starting another.'
  if (message.includes('Post limit reached')) return 'You have published several posts recently. Please try again later.'
  if (message.includes('Some post photos are not ready')) return 'A photo is still uploading. Retry publishing when it is ready.'
  if (error?.code === '42501' && step === 'insert') return `The server rejected post creation: ${describePhotoError(error)}.`
  if (error?.code === '42501' && ['identity', 'stage'].includes(step)) return 'The server rejected this post for the current account. Check that you are signed in as a Customer and retry.'
  if (error?.code === '42501' && step === 'publish') return 'This draft is no longer eligible to publish. Start a fresh post or contact support if this keeps happening.'
  if (error?.code === '42501') return 'This post can no longer be changed with your account.'
  return message ? `We couldn’t save this post: ${describePhotoError(error)}.` : 'We couldn’t save this post. Check your connection and try again.'
}

function PostFormPage({ editing = false }) {
  const { postId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [values, setValues] = useState(blank)
  const [categories, setCategories] = useState([])
  const [photos, setPhotos] = useState([])
  const [existing, setExisting] = useState([])
  const [existingUrls, setExistingUrls] = useState({})
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef(null)
  const [step, setStep] = useState(1)
  const [stagedId, setStagedId] = useState(null)
  const [uploaded, setUploaded] = useState(new Set())
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [photoDragOver, setPhotoDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  useEffect(() => {
    let active = true
    async function initialize() {
      const [{ data: categoryRows, error: categoryError }, savedDraft] = await Promise.all([
        supabase.from('service_categories').select('id, name, slug').order('name'),
        Promise.resolve(!editing ? (() => { try { return JSON.parse(localStorage.getItem(`fixora-post-draft-${user.id}`) || 'null') } catch { return null } })() : null),
      ])
      if (!active) return
      if (categoryError) showError('We couldn’t load service categories. Check your connection and retry.')
      setCategories(categoryRows ?? [])
      if (savedDraft) setValues((current) => ({ ...current, ...savedDraft, category_id: '', region: '', city: '' }))
      if (editing) {
        const { data, error: loadError } = await supabase.from('problem_posts').select(editColumns).eq('id', postId).maybeSingle()
        if (!active) return
        if (loadError || !data || data.author_id !== user.id || data.status === 'removed') {
          showError('This post is unavailable or can no longer be edited.')
        } else {
          setValues({ title: data.title, description: data.description, category_id: data.category_id, budget_type: data.budget_type, min: data.budget_min_naira?.toString() || '', max: data.budget_max_naira?.toString() || '', negotiable: data.negotiable, region: data.region, city: data.city, timing: data.timing, target_date: data.target_date || '', schedule_mode: data.schedule_mode || 'flexible', scheduled_start_at: toLagosInput(data.scheduled_start_at), scheduled_end_at: toLagosInput(data.scheduled_end_at), job_type: data.job_type })
          const beforeImages = (data.problem_post_images ?? []).filter((image) => image.kind === 'before').sort((a, b) => a.sort_order - b.sort_order)
          setExisting(beforeImages)
          setExistingUrls(Object.fromEntries(beforeImages.map((image) => [image.storage_path, getPostImageUrl(image.storage_path)])))
        }
        setLoading(false)
      }
    }
    void initialize()
    return () => { active = false }
  }, [editing, postId, user.id])

  useEffect(() => {
    if (!editing) { try { localStorage.setItem(`fixora-post-draft-${user.id}`, JSON.stringify(values)) } catch { /* Storage may be unavailable. */ } }
  }, [editing, user.id, values])

  const selectedCategory = categories.find((item) => item.id === values.category_id)
  const previewImages = [
    ...existing.map((image) => ({ key: image.storage_path, src: existingUrls[image.storage_path], alt: `Existing post photo ${image.sort_order + 1}` })),
    ...photos.map((photo, index) => ({ key: photo.url, src: photo.url, alt: `Selected post photo ${index + 1}` })),
  ].filter((image) => image.src)

  useEffect(() => {
    if (!previewPhoto) return undefined
    function closeOnEscape(event) { if (event.key === 'Escape') setPreviewPhoto(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [previewPhoto])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined
    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`)
    }
    updateKeyboardOffset()
    viewport.addEventListener('resize', updateKeyboardOffset)
    viewport.addEventListener('scroll', updateKeyboardOffset)
    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset)
      viewport.removeEventListener('scroll', updateKeyboardOffset)
      document.documentElement.style.removeProperty('--keyboard-offset')
    }
  }, [])

  function showError(message) {
    setError(message)
    window.requestAnimationFrame(() => errorRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    }))
  }
  function set(key, value) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if ((key === 'timing' && value === 'specific_date' && !current.target_date)
        || (key === 'schedule_mode' && value === 'confirmed' && !current.scheduled_start_at)) {
        const defaults = defaultSchedule()
        next.scheduled_start_at ||= defaults.start
        next.scheduled_end_at ||= defaults.end
        if (key === 'timing') next.target_date = defaults.date
      }
      return next
    })
    setError('')
  }
  function validateSchedule() {
    if (values.schedule_mode !== 'confirmed') return ''
    const start = fromLagosInput(values.scheduled_start_at)
    const end = fromLagosInput(values.scheduled_end_at)
    if (!start || !end) return 'Add the confirmed start and end time in Nigeria time (WAT).'
    if (new Date(end) <= new Date(start)) return 'The scheduled end must be after the start.'
    if (new Date(start) <= new Date()) return 'Choose a future start time for the work.'
    return ''
  }
  async function selectPhotos(files) {
    setError('')
    const remaining = 5 - existing.length - photos.length
    const picked = [...files].slice(0, remaining)
    for (const [index, file] of picked.entries()) {
      try {
        const prepared = await preparePostPhoto(file)
        setPhotos((current) => [...current, { file: prepared, url: URL.createObjectURL(prepared), name: file.name }])
      } catch (problem) {
        logPostStep('prepare', { postId: stagedId || postId, error: problem })
        showError(`Photo ${existing.length + photos.length + index + 1} failed: ${describePhotoError(problem)}.`)
        break
      }
    }
  }
  async function removePhoto(index) {
    const photo = photos[index]
    if (!photo) return
    if (photo.path) {
      const { error: storageError } = await supabase.storage.from('problem-post-photos').remove([photo.path])
      if (storageError) { logPostStep('remove_storage', { postId: stagedId || postId, error: storageError }); showError(`Could not remove this photo: ${describePhotoError(storageError)}.`); return }
      const { error: rowError } = await supabase.from('problem_post_images').delete().eq('post_id', stagedId || postId).eq('storage_path', photo.path)
      if (rowError) { logPostStep('remove_reservation', { postId: stagedId || postId, error: rowError }); showError(`Could not remove this photo: ${describePhotoError(rowError)}.`); return }
    }
    URL.revokeObjectURL(photo.url)
    setPhotos((current) => current.filter((_, i) => i !== index))
  }
  function validate() {
    if (!values.title.trim() || values.title.trim().length > 120) return 'Add a title between 1 and 120 characters.'
    if (!values.description.trim() || values.description.trim().length > 2500) return 'Add a description between 1 and 2,500 characters.'
    if (!values.category_id) return 'Choose a service category.'
    if (!values.region.trim() || !values.city.trim()) return 'Add a state and city or area.'
    if (values.budget_type !== 'open_to_quotes' && (!Number.isSafeInteger(Number(values.min)) || Number(values.min) < 1 || Number(values.min) > 100000000000)) return 'Enter a valid whole Naira amount.'
    if (values.budget_type === 'range' && (!Number.isSafeInteger(Number(values.max)) || Number(values.max) < Number(values.min) || Number(values.max) > 100000000000)) return 'Enter a valid maximum amount at or above the minimum.'
    if (values.timing === 'specific_date' && !values.target_date) return 'Choose the date you need the work.'
    const scheduleError = validateSchedule()
    if (scheduleError) return scheduleError
    return ''
  }
  function payload() {
    return { category_id: values.category_id, title: values.title.trim(), description: values.description.trim(), budget_type: values.budget_type, budget_min_naira: values.budget_type === 'open_to_quotes' ? null : Number(values.min), budget_max_naira: values.budget_type === 'range' ? Number(values.max) : null, negotiable: values.negotiable, country_code: 'NG', region: values.region.trim(), city: values.city.trim(), timing: values.timing, target_date: values.timing === 'specific_date' ? values.target_date : null, schedule_mode: values.schedule_mode, scheduled_start_at: values.schedule_mode === 'confirmed' ? fromLagosInput(values.scheduled_start_at) : null, scheduled_end_at: values.schedule_mode === 'confirmed' ? fromLagosInput(values.scheduled_end_at) : null, job_type: values.job_type }
  }
  async function removeExistingPhoto(image) {
    const { error: storageError } = await supabase.storage.from('problem-post-photos').remove([image.storage_path])
    if (storageError) { logPostStep('remove_storage', { postId, error: storageError }); throw storageError }
    const { error: rowError } = await supabase.from('problem_post_images').delete().eq('post_id', postId).eq('storage_path', image.storage_path)
    if (rowError) { logPostStep('remove_reservation', { postId, error: rowError }); throw rowError }
    setExisting((current) => current.filter((item) => item.storage_path !== image.storage_path))
  }
  async function publish() {
    if (saving) return
    const invalid = validate()
    if (invalid) { showError(invalid); return }
    if (!supabase) { showError('Post services are unavailable.'); return }
    setSaving(true); setError('')
    let currentPostId = editing ? postId : stagedId
    let writeStep = editing ? 'update' : 'stage'
    let authorId = user.id
    try {
      if (!editing) {
        writeStep = 'identity'
        const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()
        const sessionUser = sessionResult?.session?.user
        if (sessionError || !sessionUser?.id) throw sessionError || new Error('No authenticated customer session is available.')
        const { data: authResult, error: authError } = await supabase.auth.getUser()
        const verifiedUser = authResult?.user
        if (authError || !verifiedUser?.id) throw authError || new Error('No authenticated customer session is available.')
        if (verifiedUser.id !== sessionUser.id) throw new Error('Your account session changed. Please retry the post.')
        const { data: verifiedProfile, error: profileError } = await supabase.from('profiles').select('id, account_type').eq('id', sessionUser.id).maybeSingle()
        if (profileError) throw profileError
        if (verifiedProfile?.account_type !== 'customer') throw Object.assign(new Error('A customer account is required to create posts.'), { code: 'CUSTOMER_REQUIRED' })
        authorId = sessionUser.id
      }
      if (editing) {
        if (existing.length + photos.length > 5) throw new Error('Keep no more than five photos.')
        const { data: updatedPost, error: updateError } = await supabase.from('problem_posts').update(payload()).eq('id', postId).eq('author_id', user.id).neq('status', 'removed').select('id').maybeSingle()
        if (updateError || !updatedPost) { const problem = updateError || new Error('This post is no longer editable.'); console.error('[post-write]', { step: 'update', postId, code: problem.code || 'not-updated', message: problem.message }); throw problem }
        await uploadPendingPhotos(photos, uploaded, postId, user.id, existing, setUploaded, (message) => setUploadProgress(message))
        invalidatePostListCaches(user.id)
        showToast({ type: 'success', message: 'Post updated.' }); navigate(`/app/posts/${postId}`); return
      }
      if (!currentPostId) {
        writeStep = 'stage'
        const { error: staleError } = await supabase.from('problem_posts').update({ status: 'removed' }).eq('author_id', authorId).is('published_at', null).neq('status', 'removed')
        if (staleError) { console.error('[post-write]', { step: 'stage', postId: null, code: staleError.code, message: staleError.message }); throw staleError }
        writeStep = 'insert'
        let { data, error: insertError } = await supabase.from('problem_posts').insert({ author_id: authorId, ...payload() }).select('id').single()
        if (insertError?.code === '42501') {
          const firstInsertError = insertError
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
          const refreshedUser = refreshed?.session?.user
          if (refreshError || !refreshedUser?.id || refreshedUser.id !== authorId) throw firstInsertError
          const { data: refreshedProfile, error: refreshedProfileError } = await supabase.from('profiles').select('id, account_type').eq('id', refreshedUser.id).maybeSingle()
          if (refreshedProfileError || refreshedProfile?.account_type !== 'customer') throw firstInsertError
          const retryResult = await supabase.from('problem_posts').insert({ author_id: refreshedUser.id, ...payload() }).select('id').single()
          data = retryResult.data
          insertError = retryResult.error
        }
        if (insertError) throw insertError
        currentPostId = data.id; setStagedId(data.id)
      }
      writeStep = 'reserve'
      const { data: reservationRows, error: reservationError } = await supabase.from('problem_post_images').select('storage_path, sort_order, kind').eq('post_id', currentPostId).eq('kind', 'before')
      if (reservationError) { console.error('[post-write]', { step: 'reserve', postId: currentPostId, code: reservationError.code, message: reservationError.message }); throw reservationError }
      writeStep = 'upload'
      await uploadPendingPhotos(photos, uploaded, currentPostId, authorId, [...(reservationRows ?? [])], setUploaded, (message) => setUploadProgress(message))
      writeStep = 'publish'
      const { error: publishError } = await supabase.rpc('publish_problem_post', { requested_post_id: currentPostId })
      if (publishError) { console.error('[post-write]', { step: 'publish', postId: currentPostId, code: publishError.code, message: publishError.message }); throw publishError }
      const { data: published, error: verifyError } = await supabase.from('problem_posts').select('id, published_at').eq('id', currentPostId).single()
      if (verifyError || !published?.published_at) {
        const problem = verifyError || new Error('Post publication could not be confirmed.')
        console.error('[post-write]', { step: 'publish', postId: currentPostId, code: problem.code || 'unconfirmed', message: problem.message })
        throw problem
      }
      try { localStorage.removeItem(`fixora-post-draft-${authorId}`) } catch { /* ignore */ }
      invalidatePostListCaches(authorId)
      showToast({ type: 'success', message: 'Your post is live.' })
      navigate(`/app/posts/${currentPostId}`)
    } catch (problem) {
      if (writeStep === 'insert') logPostStep('insert', { postId: currentPostId, error: problem })
      if (problem?.code === 'CUSTOMER_REQUIRED') showError('Only a Customer account can create posts. Switch to your Customer account and try again.')
      else showError(errorText(problem, writeStep))
    }
    finally { setSaving(false); setUploadProgress('') }
  }

  if (loading) return <main aria-busy="true" className="app-page post-form-page post-form-page--loading"><p className="post-form-loading__status" role="status">Loading your post…</p><Skeleton className="post-form-loading__title" /><Skeleton className="post-form-loading__card" /></main>
  return (
    <main className="app-page post-form-page">
      <Link className="app-back-link post-form-back post-detail__back" to={editing ? `/app/posts/${postId}` : '/app'}><span className="post-form-back__icon"><ArrowLeft aria-hidden="true" size={18} weight="bold" /></span>Back</Link>
      <header className="post-form-heading"><p>Step {step} of 4</p><h1>{editing ? 'Edit your post' : ['Add photos and title', 'Describe the work', 'Set your budget', 'Review your post'][step - 1]}</h1><div aria-label={`Step ${step} of 4`} className="post-form-progress"><span style={{ transform: `scaleX(${step / 4})` }} /></div></header>
      {error && <p className="post-form-error" ref={errorRef} role="alert">{error}</p>}
      <div className="post-form-workspace">
      <section className={`post-form-content post-form-content--step-${step}`}>
        {step === 1 && <><InputField id="post-title" label="Title" maxLength={120} onChange={(event) => set('title', event.target.value)} placeholder="What needs fixing?" value={values.title} /><label className={`post-photo-picker${photoDragOver ? ' is-drag-over' : ''}`} onDragEnter={(event) => { event.preventDefault(); setPhotoDragOver(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPhotoDragOver(false) }} onDrop={(event) => { event.preventDefault(); setPhotoDragOver(false); void selectPhotos(event.dataTransfer.files) }}><Camera aria-hidden="true" size={27} /><strong>Add photos</strong><span>Up to 5. JPG, PNG or WebP</span><input accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void selectPhotos(event.target.files); event.target.value = '' }} type="file" /></label><div className="post-photo-list">{existing.map((image) => <div className="post-photo-item" key={image.storage_path}>{existingUrls[image.storage_path] ? <button aria-label={`Preview photo ${image.sort_order + 1}`} className="post-photo-item__preview" onClick={() => setPreviewPhoto({ src: existingUrls[image.storage_path], alt: `Existing post photo ${image.sort_order + 1}` })} type="button"><img alt="" onError={() => setExistingUrls((current) => ({ ...current, [image.storage_path]: null }))} src={existingUrls[image.storage_path]} /><span>Preview</span></button> : null}<div className="post-photo-item__details"><strong>Photo {image.sort_order + 1}</strong><button aria-label={`Remove photo ${image.sort_order + 1}`} className="post-photo-item__remove" disabled={saving} onClick={() => void removeExistingPhoto(image).catch(() => showError('Could not remove this photo. Try again.'))} type="button"><X size={18} /></button></div></div>)}{photos.map((photo, index) => <div className="post-photo-item" key={photo.url}><button aria-label={`Preview selected photo ${index + 1}`} className="post-photo-item__preview" onClick={() => setPreviewPhoto({ src: photo.url, alt: `Selected post photo ${index + 1}` })} type="button"><img alt="" src={photo.url} /><span>Preview</span></button><div className="post-photo-item__details"><strong>{photo.name}</strong><button aria-label={`Remove photo ${index + 1}`} className="post-photo-item__remove" onClick={() => void removePhoto(index)} type="button"><X size={18} /></button></div></div>)}</div>{!editing && <small className="post-photo-hint">Photos are not saved in drafts. Avoid faces, documents, or valuables.</small>}</>}
        {step === 2 && <><SelectField id="post-category" label="Service category" onChange={(event) => set('category_id', event.target.value)} value={values.category_id}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectField><label className="ui-field" htmlFor="post-description"><span className="ui-field__label">Description</span><textarea className="post-form-description" id="post-description" maxLength={2500} onChange={(event) => set('description', event.target.value)} placeholder="Describe what needs fixing, where it is, and any helpful details…" rows={7} value={values.description} /><small className="ui-field__hint">{values.description.length}/2,500</small></label></>}
        {step === 3 && <>
          <SegmentedControl label="Budget type" onChange={(value) => set('budget_type', value)} options={budgetOptions} value={values.budget_type} />
          {values.budget_type !== 'open_to_quotes' && <div className="post-form-budget"><InputField id="post-min" inputMode="numeric" label={values.budget_type === 'range' ? 'Minimum (₦)' : 'Amount (₦)'} onChange={(event) => set('min', event.target.value.replace(/\D/g, ''))} value={values.min} /><output>{values.min ? new Intl.NumberFormat('en-NG').format(Number(values.min)) : ''}</output>{values.budget_type === 'range' && <InputField id="post-max" inputMode="numeric" label="Maximum (₦)" onChange={(event) => set('max', event.target.value.replace(/\D/g, ''))} value={values.max} />}</div>}
          <label className="post-form-switch"><input checked={values.negotiable} onChange={(event) => set('negotiable', event.target.checked)} type="checkbox" />Budget is negotiable</label>
          <SelectField id="post-region" label="State or region" onChange={(event) => set('region', event.target.value)} value={values.region}><option value="">Choose a state</option>{nigerianLocations.map(([name]) => <option key={name} value={name}>{name}</option>)}{values.region && !nigerianLocations.some(([name]) => name === values.region) && <option value={values.region}>{values.region} (saved location)</option>}</SelectField>
          <div><InputField id="post-city" label="City or area" list="post-city-suggestions" maxLength={100} onChange={(event) => set('city', event.target.value)} placeholder="e.g. Ikeja" value={values.city} /><datalist id="post-city-suggestions">{suggestedCities.map((city) => <option key={city} value={city} />)}</datalist></div>
          <fieldset className="post-form-options"><legend>When do you need the work?</legend>{timings.map(([value, label]) => <Chip key={value} onClick={() => set('timing', value)} selected={values.timing === value}>{label}</Chip>)}</fieldset>
          {values.timing === 'specific_date' && <InputField id="post-date" label="Target date" onChange={(event) => set('target_date', event.target.value)} type="date" value={values.target_date} />}
          <fieldset className="post-form-options post-form-schedule"><legend>Work schedule</legend><p>Providers can only be hired when the work window is confirmed. Times use West Africa Time (WAT).</p><SegmentedControl label="Work schedule certainty" onChange={(value) => set('schedule_mode', value)} options={[{ value: 'flexible', label: 'Flexible for now' }, { value: 'confirmed', label: 'Confirm a time' }]} value={values.schedule_mode} />
            {values.schedule_mode === 'confirmed' ? <div className="post-form-schedule__times"><InputField id="post-schedule-start" label="Start (WAT)" onChange={(event) => set('scheduled_start_at', event.target.value)} type="datetime-local" value={values.scheduled_start_at} /><InputField id="post-schedule-end" label="End (WAT)" onChange={(event) => set('scheduled_end_at', event.target.value)} type="datetime-local" value={values.scheduled_end_at} /></div> : <small>Agree on a specific start and end time before choosing an applicant.</small>}
          </fieldset>
          <fieldset className="post-form-options"><legend>Type of work</legend>{jobTypes.map(([value, label]) => <Chip key={value} onClick={() => set('job_type', value)} selected={values.job_type === value}>{label}</Chip>)}</fieldset>
        </>}
        {step === 4 && <div className="post-form-review">
          {previewImages.length > 0 ? <div aria-label="Post photo preview" className="post-form-review__gallery">
            {previewImages.map((image, index) => <button aria-label={`View photo ${index + 1}`} className={index === 0 ? `post-form-review__cover${previewImages.length === 1 ? ' post-form-review__cover--single' : ''}` : 'post-form-review__thumbnail'} key={image.key} onClick={() => setPreviewPhoto(image)} type="button"><img alt={image.alt} src={image.src} /></button>)}
          </div> : <div className="post-form-review__no-photo"><ImageIcon aria-hidden="true" size={28} /><span>No photos added</span></div>}
          <div className="post-form-review__body">
            <span className="post-form-review__category">{selectedCategory?.name || 'Service request'}</span>
            <h2>{values.title.trim() || 'Your post title'}</h2>
            {(values.city || values.region) && <p className="post-form-review__location"><MapPin aria-hidden="true" size={17} />{[values.city, values.region].filter(Boolean).join(', ')}</p>}
            <p className="post-form-review__description">{values.description.trim() || 'Your description will appear here.'}</p>
            <p className="post-form-review__budget">{values.budget_type === 'open_to_quotes' ? 'Open to quotes' : `₦${values.min ? new Intl.NumberFormat('en-NG').format(Number(values.min)) : '—'}${values.budget_type === 'range' ? ` – ₦${values.max ? new Intl.NumberFormat('en-NG').format(Number(values.max)) : '—'}` : ' · Fixed'}`}{values.negotiable && <span>Negotiable</span>}</p>
            <p className="post-form-review__schedule">{values.schedule_mode === 'confirmed' && fromLagosInput(values.scheduled_start_at) && fromLagosInput(values.scheduled_end_at) ? `Scheduled ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(fromLagosInput(values.scheduled_start_at)))} – ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(fromLagosInput(values.scheduled_end_at)))} WAT` : values.schedule_mode === 'confirmed' ? 'Add a confirmed start and end time' : 'Flexible schedule · a confirmed time is required before hiring'}</p>
          </div>
          <p className="post-form-review__note">Your photos are visible to anyone with their link. Avoid sensitive images.</p>
        </div>}
        <footer className="post-form-actions">{step > 1 && <Button disabled={saving} onClick={() => setStep((current) => current - 1)} variant="secondary">Back</Button>}{step < 4 ? <Button onClick={() => { const problem = step === 1 && (!values.title.trim() || values.title.length > 120) ? 'Add a title between 1 and 120 characters.' : step === 2 && (!values.category_id || !values.description.trim()) ? 'Choose a category and describe the work.' : step === 3 && (!values.region.trim() || !values.city.trim()) ? 'Choose a state and city or area before continuing.' : step === 3 ? validateSchedule() : ''; if (problem) showError(problem); else { setError(''); setStep((current) => current + 1) } }}>{saving && uploadProgress ? uploadProgress : 'Next'}</Button> : <Button loading={saving} onClick={() => void publish()}>{saving && uploadProgress ? uploadProgress : editing ? 'Save changes' : 'Publish post'}</Button>}</footer>
      </section>
      <aside aria-label="Request guidance" className="post-form-aside">
        <MarketplaceDoodle />
        <span className="app-eyebrow">As you work</span>
        <h2>Help professionals understand the job.</h2>
        <p>Share the work needed and the area where it should happen. Keep your street address and sensitive details private.</p>
        <div className="post-form-aside__summary">
          <span>Request title</span><strong>{values.title.trim() || 'Add a short title'}</strong>
          <span>Service</span><strong>{selectedCategory?.name || 'Not chosen yet'}</strong>
          <span>Area</span><strong>{[values.city, values.region].filter(Boolean).join(', ') || 'Not chosen yet'}</strong>
          <span>Schedule</span><strong>{values.schedule_mode === 'confirmed' && values.scheduled_start_at ? 'Confirmed · WAT' : 'Flexible'}</strong>
        </div>
      </aside>
      </div>
      {previewPhoto && <OverlayPortal><div className="post-photo-lightbox" onClick={(event) => { if (event.target === event.currentTarget) setPreviewPhoto(null) }} role="presentation"><section aria-label="Photo preview" aria-modal="true" className="post-photo-lightbox__panel" role="dialog"><button aria-label="Close photo preview" className="post-photo-lightbox__close" onClick={() => setPreviewPhoto(null)} type="button"><X aria-hidden="true" size={22} /></button><img alt={previewPhoto.alt} src={previewPhoto.src} /></section></div></OverlayPortal>}
    </main>
  )
}

async function uploadPhoto(photo, postId, userId, reservations, uploaded, setUploaded, taken = new Set(reservations.map((row) => row.sort_order)), photoNumber = 1) {
  let sortOrder = 0
  while (taken.has(sortOrder) && sortOrder < 5) sortOrder += 1
  if (sortOrder >= 5) throw Object.assign(new Error('Keep no more than five photos.'), { photoNumber })
  taken.add(sortOrder)
  photoNumber = sortOrder + 1
  const path = `${userId}/${postId}/${sortOrder}.jpg`
  const { error: reserveError } = await supabase.from('problem_post_images').insert({ post_id: postId, storage_path: path, sort_order: sortOrder, kind: 'before' })
  if (reserveError) { taken.delete(sortOrder); logPostStep('reserve', { postId, error: reserveError }); throw Object.assign(reserveError, { photoNumber }) }
  const { error: uploadError } = await supabase.storage.from('problem-post-photos').upload(path, photo.file, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) {
    logPostStep('upload', { postId, error: uploadError })
    const { error: cleanupError } = await supabase.from('problem_post_images').delete().eq('post_id', postId).eq('storage_path', path)
    if (cleanupError) logPostStep('reservation_cleanup', { postId, error: cleanupError })
    taken.delete(sortOrder)
    throw Object.assign(uploadError, { photoNumber })
  }
  photo.path = path
  setUploaded((current) => new Set([...current, photo]))
}

async function uploadPendingPhotos(photos, uploaded, postId, userId, reservations, setUploaded, onProgress) {
  const pending = photos.filter((photo) => !uploaded.has(photo))
  if (!pending.length) return
  const taken = new Set(reservations.map((row) => row.sort_order))
  let completed = 0
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(2, pending.length) }, async () => {
    while (nextIndex < pending.length) {
      const index = nextIndex++
      const photo = pending[index]
      onProgress(`Uploading photo ${completed + 1} of ${pending.length}…`)
      await uploadPhoto(photo, postId, userId, reservations, uploaded, setUploaded, taken, index + 1)
      completed += 1
      onProgress(completed < pending.length ? `Uploaded ${completed} of ${pending.length} photos…` : 'Finishing photo uploads…')
    }
  })
  await Promise.all(workers)
}

export function CreatePostPage() { return <PostFormPage /> }
export function EditPostPage() { return <PostFormPage editing /> }
