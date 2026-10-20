import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Camera, Star, X } from '@phosphor-icons/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { describePhotoError, getPostImageUrl, logPostStep, preparePostPhoto } from '../lib/postImages.js'
import { fetchProblemPost, formatPostBudget } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'
import './CompleteJobPage.css'

const ratingLabels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']
const formatNairaInput = (value) => value ? new Intl.NumberFormat('en-NG').format(Number(value)) : ''

export default function CompleteJobPage() {
  const { postId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [step, setStep] = useState(1)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState([])
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [celebrating, setCelebrating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchProblemPost(postId)
      if (!result || result.author_id !== user?.id || result.status !== 'closed' || !result.hired_professional_id) {
        setPost(null)
        return
      }
      setPost(result)
      setPhotos((result.images ?? []).filter((image) => image.kind === 'after').map((image) => ({
        path: image.storage_path, sort_order: image.sort_order, url: getPostImageUrl(image.storage_path),
        existing: true, name: `After photo ${image.sort_order + 1}`,
      })))
      if (!price && result.budget_type === 'fixed' && result.budget_min_naira) setPrice(String(result.budget_min_naira))
    } catch {
      setError('We couldn’t load this job. Check your connection and retry.')
    } finally { setLoading(false) }
  }, [postId, user?.id])

  useEffect(() => { void load() }, [load])

  async function addPhotos(files) {
    setError('')
    for (const file of [...files].slice(0, Math.max(0, 3 - photos.length))) {
      try {
        const prepared = await preparePostPhoto(file)
        setPhotos((current) => current.length < 3 ? [...current, { file: prepared, url: URL.createObjectURL(prepared), name: file.name }] : current)
      } catch (problem) {
        logPostStep('complete_prepare_photo', { postId, error: problem })
        setError(`Photo preparation failed: ${describePhotoError(problem)}.`)
        break
      }
    }
  }

  function removePhoto(index) {
    const photo = photos[index]
    if (photo?.existing) return
    if (photo?.url && !photo.existing && photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url)
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function submit() {
    if (!post || busy) return
    if (photos.length < 1) { setError('Show the result: add at least one after photo.'); setStep(2); return }
    if (!rating) { setError('How did it go? Choose a star rating.'); setStep(1); return }
    if (!Number.isSafeInteger(Number(price)) || Number(price) < 1 || Number(price) > 100000000000) { setError('Final price: enter a valid positive Naira amount.'); return }
    setBusy(true)
    setError('')
    try {
      let nextPhotos = [...photos]
      const usedOrders = new Set(nextPhotos.filter((photo) => photo.path).map((photo) => photo.sort_order))
      for (let index = 0; index < nextPhotos.length; index += 1) {
        const photo = nextPhotos[index]
        if (photo.existing) continue
        let order = photo.sort_order
        if (order == null) {
          order = 0
          while (usedOrders.has(order) && order < 5) order += 1
          if (order >= 5) throw new Error('Show the result: the after-photo limit is five.')
          usedOrders.add(order)
          photo.sort_order = order
          photo.path = `${user.id}/${post.id}/after-${order}.jpg`
          nextPhotos[index] = photo
          setPhotos([...nextPhotos])
        }
        const { error: reserveError } = await supabase.from('problem_post_images').insert({ post_id: post.id, storage_path: photo.path, sort_order: order, kind: 'after' })
        if (reserveError) {
          const { data: existingRow, error: lookupError } = await supabase.from('problem_post_images')
            .select('post_id, storage_path, sort_order, kind').eq('post_id', post.id).eq('storage_path', photo.path).maybeSingle()
          if (lookupError || !existingRow || existingRow.kind !== 'after') throw reserveError
        }
        const bucket = supabase.storage.from('problem-post-photos')
        const { error: existingFileError } = await bucket.download(photo.path)
        let uploadError = null
        if (existingFileError) {
          const uploaded = await bucket.upload(photo.path, photo.file, { contentType: 'image/jpeg', upsert: false })
          uploadError = uploaded.error
          if (uploadError && (uploadError.statusCode === '409' || uploadError.statusCode === '400')) {
            const { error: retryCheckError } = await bucket.download(photo.path)
            if (!retryCheckError) uploadError = null
          }
        }
        if (uploadError) {
          logPostStep('complete_upload', { postId: post.id, error: uploadError })
          throw new Error(`Show the result: photo ${order + 1} couldn’t upload. Check your connection and retry.`)
        }
        photo.existing = true
        nextPhotos[index] = photo
        setPhotos([...nextPhotos])
      }
      const { error: completeError } = await supabase.rpc('complete_job', {
        requested_post_id: post.id,
        requested_rating: rating,
        requested_comment: comment.trim() || null,
        requested_final_price: Number(price),
      })
      if (completeError) {
        logPostStep('complete_job', { postId: post.id, error: completeError })
        throw new Error("We couldn't complete this job. Check your connection and try again.")
      }
      setCelebrating(true)
      window.setTimeout(() => navigate(`/app/posts/${post.id}`, { replace: true }), 700)
      showToast({ type: 'success', message: 'Job marked as completed. Thank you for your review.' })
    } catch (problem) {
      if (problem.message?.startsWith('Show the result:')) {
        setError(`${problem.message} Your entries are saved here; retry when ready.`)
      } else {
        logPostStep('complete_reserve', { postId: post.id, error: problem })
        setError("We couldn't complete this job. Check your connection and try again. Your entries are saved here; retry when ready.")
      }
    } finally { setBusy(false) }
  }

  if (loading) return <main className="app-page complete-job-page"><Skeleton style={{ height: '22rem' }} /></main>
  if (!post) return <main className="app-page complete-job-page"><section className="posts-feed__error" role="alert"><p>{error || 'This job is unavailable or was already completed.'}</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section></main>

  return <main className={`app-page complete-job-page${celebrating ? ' is-celebrating' : ''}`}>
    <Link className="app-back-link" to={`/app/posts/${post.id}`}><ArrowLeft aria-hidden="true" size={19} />Back to request</Link>
    <header className="complete-job-heading"><span>Step {step} of 3</span><h1>{['How did it go?', 'Show the result', 'Final price'][step - 1]}</h1><div aria-label={`Step ${step} of 3`} className="complete-job-progress"><span style={{ transform: `scaleX(${step / 3})` }} /></div></header>
    {error && <p className="post-form-error" role="alert">{error}</p>}
    <section className="complete-job-card">
      {step === 1 && <div className="complete-job-rating"><div aria-label="Rate the completed work" className="complete-job-stars" role="group">{ratingLabels.map((label, index) => <button aria-label={`${index + 1} stars: ${label}`} aria-pressed={rating === index + 1} className={rating >= index + 1 ? 'is-selected' : ''} key={label} onClick={() => { setRating(index + 1); setError('') }} type="button"><Star aria-hidden="true" size={38} weight={rating >= index + 1 ? 'fill' : 'regular'} /></button>)}</div><p className="complete-job-rating__label">{rating ? ratingLabels[rating - 1] : 'Choose a rating'}</p><label className="ui-field" htmlFor="job-review"><span className="ui-field__label">Your review <small>(optional)</small></span><textarea id="job-review" maxLength={600} onChange={(event) => setComment(event.target.value)} placeholder="Share what went well or what could improve." rows={5} value={comment} /><small className="ui-field__hint">{comment.length}/600</small></label></div>}
      {step === 2 && <div className="complete-job-photos"><label className="complete-job-dropzone"><Camera aria-hidden="true" size={30} /><strong>Add after photos</strong><span>Up to 3. JPG, PNG or WebP</span><input accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addPhotos(event.target.files); event.target.value = '' }} type="file" /></label><div className="complete-job-photo-grid">{photos.map((photo, index) => <figure key={photo.path || photo.url}><img alt={`Completed work photo ${index + 1}`} onError={(event) => { if (photo.existing) event.currentTarget.hidden = true }} src={photo.url} />{!photo.existing && <button aria-label={`Remove photo ${index + 1}`} disabled={busy} onClick={() => removePhoto(index)} type="button"><X aria-hidden="true" size={17} /></button>}</figure>)}</div><p className="complete-job-hint">Choose clear photos of the finished work. Avoid faces, documents, or personal details.</p></div>}
      {step === 3 && <div className="complete-job-final"><label className="ui-field" htmlFor="final-price"><span className="ui-field__label">Final amount paid (₦)</span><input autoComplete="off" inputMode="numeric" id="final-price" onChange={(event) => setPrice(event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="Enter final price" value={formatNairaInput(price)} /></label><div className="complete-job-summary"><h2>{post.title}</h2><p>{post.service_categories?.name} · {[post.city, post.region].filter(Boolean).join(', ')}</p><p>Rating: {'★'.repeat(rating)}{'☆'.repeat(5 - rating)} · {ratingLabels[rating - 1]}</p><p>{comment.trim() || 'No written review'}</p><p>{photos.length} after {photos.length === 1 ? 'photo' : 'photos'}</p><strong>{price ? `₦${formatNairaInput(price)}` : formatPostBudget(post)}</strong></div></div>}
      <footer className="complete-job-actions">{step > 1 && <Button disabled={busy} onClick={() => { setError(''); setStep((current) => current - 1) }} variant="secondary">Back</Button>}{step < 3 ? <Button onClick={() => { if (step === 1 && !rating) { setError('How did it go? Choose a star rating.'); return } if (step === 2 && !photos.length) { setError('Show the result: add at least one after photo.'); return } setError(''); setStep((current) => current + 1) }}>Next</Button> : <Button loading={busy} onClick={() => void submit()}>Confirm completion</Button>}</footer>
    </section>
    <p className="complete-job-post-summary">Completing: <strong>{post.title}</strong></p>
  </main>
}
