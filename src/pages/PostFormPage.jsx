import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X } from '@phosphor-icons/react'
import { Button, Chip, InputField, SegmentedControl, SelectField } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { preparePostPhoto } from '../lib/postImages.js'
import { signPostImages } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'
import '../components/Posts.css'
import './PostFormPage.css'

const blank = { title: '', description: '', category_id: '', budget_type: 'open_to_quotes', min: '', max: '', negotiable: false, region: '', city: '', timing: 'flexible', target_date: '', job_type: 'repair' }
const budgetOptions = [{ value: 'fixed', label: 'Fixed' }, { value: 'range', label: 'Range' }, { value: 'open_to_quotes', label: 'Open to quotes' }]
const timings = [['urgent', 'Urgent'], ['this_week', 'This week'], ['flexible', 'Flexible'], ['specific_date', 'Pick a date']]
const jobTypes = [['repair', 'Repair'], ['installation', 'Installation'], ['maintenance', 'Maintenance'], ['new_project', 'New project']]
const editColumns = 'id, author_id, category_id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, job_type, status, published_at, problem_post_images(storage_path, sort_order)'

function errorText(error) {
  const message = error?.message || ''
  if (message.includes('Unpublished post limit reached')) return 'You have reached the draft limit. Remove an unfinished post before starting another.'
  if (message.includes('Post limit reached')) return 'You have published several posts recently. Please try again later.'
  if (message.includes('Some post photos are not ready')) return 'A photo is still uploading. Retry publishing when it is ready.'
  if (error?.code === '42501') return 'This post can no longer be changed with your account.'
  return 'We couldn’t save this post. Check your connection and try again.'
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
  const [photosEditable, setPhotosEditable] = useState(true)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [stagedId, setStagedId] = useState(null)
  const [uploaded, setUploaded] = useState(new Set())

  useEffect(() => {
    let active = true
    async function initialize() {
      const [{ data: categoryRows, error: categoryError }, savedDraft] = await Promise.all([
        supabase.from('service_categories').select('id, name, slug').order('name'),
        Promise.resolve(!editing ? (() => { try { return JSON.parse(localStorage.getItem(`fixora-post-draft-${user.id}`) || 'null') } catch { return null } })() : null),
      ])
      if (!active) return
      if (categoryError) setError('We couldn’t load service categories. Check your connection and retry.')
      setCategories(categoryRows ?? [])
      if (savedDraft) setValues((current) => ({ ...current, ...savedDraft }))
      if (editing) {
        const { data, error: loadError } = await supabase.from('problem_posts').select(editColumns).eq('id', postId).maybeSingle()
        if (!active) return
        if (loadError || !data || data.author_id !== user.id || data.status === 'removed') {
          setError('This post is unavailable or can no longer be edited.')
        } else {
          setPhotosEditable(data.status === 'open')
          setValues({ title: data.title, description: data.description, category_id: data.category_id, budget_type: data.budget_type, min: data.budget_min_naira?.toString() || '', max: data.budget_max_naira?.toString() || '', negotiable: data.negotiable, region: data.region, city: data.city, timing: data.timing, target_date: data.target_date || '', job_type: data.job_type })
          setExisting((data.problem_post_images ?? []).sort((a, b) => a.sort_order - b.sort_order))
          try { setExistingUrls(await signPostImages((data.problem_post_images ?? []).map((image) => image.storage_path))) } catch { /* Photos can still be removed by their storage path. */ }
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

  function set(key, value) { setValues((current) => ({ ...current, [key]: value })) }
  async function selectPhotos(files) {
    setError('')
    const remaining = 5 - existing.length - photos.length
    const picked = [...files].slice(0, remaining)
    for (const file of picked) {
      try {
        const prepared = await preparePostPhoto(file)
        setPhotos((current) => [...current, { file: prepared, url: URL.createObjectURL(prepared), name: file.name }])
      } catch (problem) { setError(problem.message); break }
    }
  }
  async function removePhoto(index) {
    const photo = photos[index]
    if (!photo) return
    if (photo.path) {
      const { error: storageError } = await supabase.storage.from('problem-post-photos').remove([photo.path])
      if (storageError) { console.error('[post-write]', { step: 'update', postId: stagedId || postId, code: storageError.code, message: storageError.message }); setError('Could not remove this photo. Try again.'); return }
      const { error: rowError } = await supabase.from('problem_post_images').delete().eq('post_id', stagedId || postId).eq('storage_path', photo.path)
      if (rowError) { console.error('[post-write]', { step: 'update', postId: stagedId || postId, code: rowError.code, message: rowError.message }); setError('Could not remove this photo. Try again.'); return }
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
    return ''
  }
  function payload() {
    return { category_id: values.category_id, title: values.title.trim(), description: values.description.trim(), budget_type: values.budget_type, budget_min_naira: values.budget_type === 'open_to_quotes' ? null : Number(values.min), budget_max_naira: values.budget_type === 'range' ? Number(values.max) : null, negotiable: values.negotiable, country_code: 'NG', region: values.region.trim(), city: values.city.trim(), timing: values.timing, target_date: values.timing === 'specific_date' ? values.target_date : null, job_type: values.job_type }
  }
  async function removeExistingPhoto(image) {
    const { error: storageError } = await supabase.storage.from('problem-post-photos').remove([image.storage_path])
    if (storageError) { console.error('[post-write]', { step: 'update', postId, code: storageError.code, message: storageError.message }); throw storageError }
    const { error: rowError } = await supabase.from('problem_post_images').delete().eq('post_id', postId).eq('storage_path', image.storage_path)
    if (rowError) { console.error('[post-write]', { step: 'update', postId, code: rowError.code, message: rowError.message }); throw rowError }
    setExisting((current) => current.filter((item) => item.storage_path !== image.storage_path))
  }
  async function publish() {
    if (saving) return
    const invalid = validate()
    if (invalid) { setError(invalid); return }
    if (!supabase) { setError('Post services are unavailable.'); return }
    setSaving(true); setError('')
    let currentPostId = editing ? postId : stagedId
    try {
      if (editing) {
        if (existing.length + photos.length > 5) throw new Error('Keep no more than five photos.')
        const { error: updateError } = await supabase.from('problem_posts').update(payload()).eq('id', postId).eq('author_id', user.id).eq('status', 'open')
        if (updateError) { console.error('[post-write]', { step: 'update', postId, code: updateError.code, message: updateError.message }); throw updateError }
        if (photosEditable) {
          const taken = new Set(existing.map((image) => image.sort_order))
          for (const image of photos) await uploadPhoto(image, postId, user.id, existing, uploaded, setUploaded, taken)
        }
        showToast({ type: 'success', message: 'Post updated.' }); navigate(`/app/posts/${postId}`); return
      }
      if (!currentPostId) {
        const { error: staleError } = await supabase.from('problem_posts').update({ status: 'removed' }).eq('author_id', user.id).is('published_at', null).neq('status', 'removed')
        if (staleError) { console.error('[post-write]', { step: 'stage', postId: null, code: staleError.code, message: staleError.message }); throw staleError }
        const { data, error: insertError } = await supabase.from('problem_posts').insert({ author_id: user.id, ...payload() }).select('id').single()
        if (insertError) { console.error('[post-write]', { step: 'insert', postId: null, code: insertError.code, message: insertError.message }); throw insertError }
        currentPostId = data.id; setStagedId(data.id)
      }
      const { data: reservationRows, error: reservationError } = await supabase.from('problem_post_images').select('storage_path, sort_order').eq('post_id', currentPostId)
      if (reservationError) { console.error('[post-write]', { step: 'reserve', postId: currentPostId, code: reservationError.code, message: reservationError.message }); throw reservationError }
      const taken = new Set((reservationRows ?? []).map((row) => row.sort_order))
      for (const photo of photos) if (!uploaded.has(photo)) await uploadPhoto(photo, currentPostId, user.id, [...(reservationRows ?? [])], uploaded, setUploaded, taken)
      const { error: publishError } = await supabase.rpc('publish_problem_post', { requested_post_id: currentPostId })
      if (publishError) { console.error('[post-write]', { step: 'publish', postId: currentPostId, code: publishError.code, message: publishError.message }); throw publishError }
      const { data: published, error: verifyError } = await supabase.from('problem_posts').select('id, published_at').eq('id', currentPostId).single()
      if (verifyError || !published?.published_at) {
        const problem = verifyError || new Error('Post publication could not be confirmed.')
        console.error('[post-write]', { step: 'publish', postId: currentPostId, code: problem.code || 'unconfirmed', message: problem.message })
        throw problem
      }
      try { localStorage.removeItem(`fixora-post-draft-${user.id}`) } catch { /* ignore */ }
      showToast({ type: 'success', message: 'Your post is live.' })
      navigate(`/app/posts/${currentPostId}`)
    } catch (problem) { setError(errorText(problem)) }
    finally { setSaving(false) }
  }

  if (loading) return <main className="app-page"><p role="status">Loading your post…</p></main>
  return (
    <main className="app-page post-form-page">
      <Link className="app-back-link post-detail__back" to={editing ? `/app/posts/${postId}` : '/app'}><ArrowLeft aria-hidden="true" size={19} />Back</Link>
      <header className="post-form-heading"><p>Step {step} of 4</p><h1>{editing ? 'Edit your post' : ['Add photos and title', 'Describe the work', 'Set your budget', 'Review your post'][step - 1]}</h1><div aria-label={`Step ${step} of 4`} className="post-form-progress"><span style={{ transform: `scaleX(${step / 4})` }} /></div></header>
      {error && <p className="post-form-error" role="alert">{error}</p>}
      <section className="post-form-content">
        {step === 1 && <><InputField id="post-title" label="Title" maxLength={120} onChange={(event) => set('title', event.target.value)} placeholder="What needs fixing?" value={values.title} />{photosEditable && <label className="post-photo-picker">Add photos (optional)<input accept="image/*" multiple onChange={(event) => { void selectPhotos(event.target.files); event.target.value = '' }} type="file" /></label>}<div className="post-photo-list">{existing.map((image) => <div key={image.storage_path}>{existingUrls[image.storage_path] && <img alt="Existing post photo" src={existingUrls[image.storage_path]} />}<span>Photo {image.sort_order + 1}</span>{photosEditable && <button aria-label={`Remove photo ${image.sort_order + 1}`} disabled={saving} onClick={() => void removeExistingPhoto(image).catch(() => setError('Could not remove this photo. Try again.'))} type="button"><X size={18} /></button>}</div>)}{photos.map((photo, index) => <div key={photo.url}><img alt={`Selected photo ${index + 1}`} src={photo.url} /><span>{photo.name}</span><button aria-label={`Remove photo ${index + 1}`} onClick={() => void removePhoto(index)} type="button"><X size={18} /></button></div>)}</div>{!editing && <small>Photos are not saved in drafts. Avoid faces, documents, or valuables.</small>}</>}
        {step === 2 && <><SelectField id="post-category" label="Service category" onChange={(event) => set('category_id', event.target.value)} value={values.category_id}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectField><label className="ui-field" htmlFor="post-description"><span className="ui-field__label">Description</span><textarea id="post-description" maxLength={2500} onChange={(event) => set('description', event.target.value)} rows={7} value={values.description} /><small className="ui-field__hint">{values.description.length}/2,500</small></label></>}
        {step === 3 && <><SegmentedControl label="Budget type" onChange={(value) => set('budget_type', value)} options={budgetOptions} value={values.budget_type} />{values.budget_type !== 'open_to_quotes' && <div className="post-form-budget"><InputField id="post-min" inputMode="numeric" label={values.budget_type === 'range' ? 'Minimum (₦)' : 'Amount (₦)'} onChange={(event) => set('min', event.target.value.replace(/\D/g, ''))} value={values.min} /><output>{values.min ? new Intl.NumberFormat('en-NG').format(Number(values.min)) : ''}</output>{values.budget_type === 'range' && <InputField id="post-max" inputMode="numeric" label="Maximum (₦)" onChange={(event) => set('max', event.target.value.replace(/\D/g, ''))} value={values.max} />}</div>}<label className="post-form-switch"><input checked={values.negotiable} onChange={(event) => set('negotiable', event.target.checked)} type="checkbox" />Budget is negotiable</label><InputField id="post-region" label="State or region" onChange={(event) => set('region', event.target.value)} placeholder="e.g. Lagos State" value={values.region} /><InputField id="post-city" label="City or area" onChange={(event) => set('city', event.target.value)} placeholder="e.g. Ikeja" value={values.city} /><fieldset className="post-form-options"><legend>When do you need the work?</legend>{timings.map(([value, label]) => <Chip key={value} onClick={() => set('timing', value)} selected={values.timing === value}>{label}</Chip>)}</fieldset>{values.timing === 'specific_date' && <InputField id="post-date" label="Date" onChange={(event) => set('target_date', event.target.value)} type="date" value={values.target_date} />}<fieldset className="post-form-options"><legend>Type of work</legend>{jobTypes.map(([value, label]) => <Chip key={value} onClick={() => set('job_type', value)} selected={values.job_type === value}>{label}</Chip>)}</fieldset></>}
        {step === 4 && <div className="post-form-review"><strong>{values.title || 'Your post title'}</strong><p>{selectedCategory?.name || 'Choose a category'} · {values.city}{values.region ? `, ${values.region}` : ''}</p><p>{values.description}</p><p>{values.budget_type === 'open_to_quotes' ? 'Open to quotes' : `₦${values.min}${values.budget_type === 'range' ? ` – ₦${values.max}` : ''}`}</p><small>Your post photos are visible to signed-in Fixora users. Do not upload sensitive images.</small></div>}
      </section>
      <footer className="post-form-actions">{step > 1 && <Button disabled={saving} onClick={() => setStep((current) => current - 1)} variant="secondary">Back</Button>}{step < 4 ? <Button onClick={() => { const problem = step === 1 && (!values.title.trim() || values.title.length > 120) ? 'Add a title between 1 and 120 characters.' : step === 2 && (!values.category_id || !values.description.trim()) ? 'Choose a category and describe the work.' : ''; if (problem) setError(problem); else { setError(''); setStep((current) => current + 1) } }}>Next</Button> : <Button loading={saving} onClick={() => void publish()}>{editing ? 'Save changes' : 'Publish post'}</Button>}</footer>
    </main>
  )
}

async function uploadPhoto(photo, postId, userId, reservations, uploaded, setUploaded, taken = new Set(reservations.map((row) => row.sort_order))) {
  let sortOrder = 0
  while (taken.has(sortOrder) && sortOrder < 5) sortOrder += 1
  if (sortOrder >= 5) throw new Error('Keep no more than five photos.')
  const path = `${userId}/${postId}/${sortOrder}.jpg`
  const { error: reserveError } = await supabase.from('problem_post_images').insert({ post_id: postId, storage_path: path, sort_order: sortOrder })
  if (reserveError) { console.error('[post-write]', { step: 'reserve', postId, code: reserveError.code, message: reserveError.message }); throw reserveError }
  const { error: uploadError } = await supabase.storage.from('problem-post-photos').upload(path, photo.file, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) {
    console.error('[post-write]', { step: 'upload', postId, code: uploadError.code, message: uploadError.message })
    await supabase.from('problem_post_images').delete().eq('post_id', postId).eq('storage_path', path)
    throw uploadError
  }
  photo.path = path
  setUploaded((current) => new Set([...current, photo])); taken.add(sortOrder)
}

export function CreatePostPage() { return <PostFormPage /> }
export function EditPostPage() { return <PostFormPage editing /> }
