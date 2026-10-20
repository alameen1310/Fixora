import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarBlank, DotsThree, MapPin, Wrench } from '@phosphor-icons/react'
import { Star } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import { ActionSheet, Avatar, Badge, Button, ProviderTypeBadge, Skeleton } from '../components/UiPrimitives.jsx'
import { fetchProblemPost, formatNaira, formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { getPostImageUrl } from '../lib/postImages.js'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../components/ToastProvider.jsx'
import { fetchMyApplication, fetchPostApplicationCount } from '../lib/applicationQueries.js'
import BeforeAfterSlider from '../components/BeforeAfterSlider.jsx'
import { FEATURES } from '../config/features.js'
import { avatarUrl } from '../lib/avatarImages.js'
import { usePresence } from '../components/PresenceProvider.jsx'
import '../components/Posts.css'

function ReviewStars({ rating }) {
  return <span aria-label={`${rating} out of 5 stars`} className="completed-post-review__stars">{[1, 2, 3, 4, 5].map((value) => <Star aria-hidden="true" key={value} size={16} weight={rating >= value ? 'fill' : 'regular'} />)}</span>
}

export default function PostDetailPage() {
  const { postId } = useParams()
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { isOnline, refreshPresence } = usePresence()
  const [post, setPost] = useState(null)
  const [imageUrls, setImageUrls] = useState({})
  const [activePhoto, setActivePhoto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [application, setApplication] = useState(null)
  const [providerPublished, setProviderPublished] = useState(false)
  const [applicationCount, setApplicationCount] = useState(0)
  const [applicationMessage, setApplicationMessage] = useState('')
  const [completion, setCompletion] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const result = await fetchProblemPost(postId)
      if (!result) {
        setPost(null)
        return
      }
      const isOwner = result.author_id === user?.id
      let ownApplication = null
      if (!isOwner && profile?.account_type === 'provider') {
        const [{ data: providerDetails, error: providerError }, savedApplication] = await Promise.all([
          supabase.from('provider_profiles').select('profile_id, is_published').eq('profile_id', user.id).maybeSingle(),
          fetchMyApplication(postId, user.id),
        ])
        if (providerError) throw providerError
        setProviderPublished(Boolean(providerDetails?.is_published))
        ownApplication = savedApplication
        if (result.status !== 'open' && result.status !== 'completed' && !ownApplication) { setPost(null); return }
      } else if (!isOwner && (result.status !== 'open' && result.status !== 'completed' || result.status === 'open' && !result.published_at)) {
        setPost(null)
        return
      }
      setPost(result)
      setApplication(ownApplication)
      if (isOwner) setApplicationCount(await fetchPostApplicationCount(postId))
      setImageUrls(Object.fromEntries(result.images.map(({ storage_path }) => [storage_path, getPostImageUrl(storage_path)])))
      if (result.status === 'completed' && result.hired_professional_id) {
        const [providerResult, reviewResult, ratingResult] = await Promise.all([
          supabase.from('provider_profiles').select('profile_id, display_name, provider_type, avatar_path, availability').eq('profile_id', result.hired_professional_id).maybeSingle(),
          supabase.from('job_reviews').select('id, post_id, provider_id, customer_id, rating, comment, customer_display_name, created_at').eq('post_id', result.id).maybeSingle(),
          supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').eq('provider_id', result.hired_professional_id).maybeSingle(),
        ])
        if (providerResult.error) throw providerResult.error
        if (reviewResult.error) throw reviewResult.error
        if (ratingResult.error) throw ratingResult.error
        setCompletion({ provider: providerResult.data, review: reviewResult.data, rating: ratingResult.data })
      } else setCompletion(null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [postId, user?.id, profile?.account_type])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (completion?.provider?.profile_id) void refreshPresence([completion.provider.profile_id]) }, [completion?.provider?.profile_id, refreshPresence])

  if (loading) return <main className="app-page post-detail"><Skeleton className="post-detail__hero-skeleton" /><Skeleton className="post-skeleton-line" /><Skeleton className="post-skeleton-line post-skeleton-line--medium" /></main>
  if (error) return <main className="app-page"><section className="posts-feed__error" role="alert"><h1>We couldn’t load this post</h1><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section></main>
  if (!post) return <main className="app-page"><section className="app-unavailable-state"><h1>Post not found</h1><p>This post may have been closed or removed.</p><Button as={Link} to="/app" variant="secondary">Back to posts</Button></section></main>

  const location = [post.city, post.region].filter(Boolean).join(', ')
  const timing = post.timing === 'specific_date' && post.target_date
    ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${post.target_date}T00:00:00`))
    : post.timing.replaceAll('_', ' ')
  const scheduleLabel = post.schedule_mode === 'confirmed' && post.scheduled_start_at && post.scheduled_end_at
    ? `${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(post.scheduled_start_at))} – ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(post.scheduled_end_at))} WAT`
    : 'Schedule to be agreed before hiring'

  function hideMissingImage(path) { setImageUrls((current) => ({ ...current, [path]: null })) }

  async function changeStatus(status) {
    setActionBusy(true)
    const { error: updateError } = await supabase.from('problem_posts').update({ status }).eq('id', post.id).eq('author_id', user.id)
    setActionBusy(false)
    if (updateError) { console.error('[post-write]', { step: 'update', postId: post.id, code: updateError.code, message: updateError.message }); showToast({ type: 'error', message: 'Could not update this post. Try again.' }); return }
    showToast({ type: 'success', message: status === 'removed' ? 'Post removed.' : status === 'closed' ? 'Post closed.' : 'Post reopened.' })
    setPost((current) => ({ ...current, status }))
  }

  async function applyToPost() {
    if (actionBusy || !supabase) return
    setActionBusy(true)
    const { data, error: applyError } = await supabase.from('problem_post_applications')
      .insert({ post_id: post.id, professional_id: user.id, message: applicationMessage.trim() || null })
      .select('id, post_id, professional_id, message, status, created_at, updated_at').single()
    setActionBusy(false)
    if (applyError) {
      console.error('[marketplace-write]', { step: 'apply', postId: post.id, code: applyError.code, message: applyError.message })
      const message = applyError.code === '23505'
        ? 'You have already applied to this request.'
        : applyError.code === '42501'
          ? 'Your application could not be accepted. Confirm your professional profile is published and the request is still open.'
          : 'Check your connection and try again. Your application has not been submitted.'
      showToast({ type: 'error', message: `Could not submit your application: ${message}` })
      return
    }
    setApplication(data)
    setApplicationCount((count) => count + 1)
    setApplicationMessage('')
    showToast({ type: 'success', message: 'Your application was sent.' })
  }

  async function withdrawApplication() {
    if (!application || actionBusy) return
    setActionBusy(true)
    const { error: withdrawError } = await supabase.from('problem_post_applications')
      .update({ status: 'withdrawn' }).eq('id', application.id).eq('professional_id', user.id).eq('status', 'pending')
    setActionBusy(false)
    if (withdrawError) {
      console.error('[marketplace-write]', { step: 'withdraw', postId: post.id, code: withdrawError.code, message: withdrawError.message })
      showToast({ type: 'error', message: 'Could not withdraw your application. Please try again.' })
      return
    }
    setApplication((current) => ({ ...current, status: 'withdrawn' }))
    showToast({ type: 'success', message: 'Application withdrawn.' })
  }

  return (
    <main className="app-page post-detail">
      <nav aria-label="Request navigation" className="post-detail__navigation"><Link className="app-back-link post-detail__back" to="/app"><ArrowLeft aria-hidden="true" size={19} /><span>Back</span></Link><strong>Request</strong>{post.author_id === user?.id && post.status !== 'removed' && post.status !== 'completed' && <details className="post-detail__owner-menu"><summary aria-label="Request actions"><DotsThree aria-hidden="true" size={22} /></summary><div><Link to={`/app/posts/${post.id}/edit`}>Edit request</Link>{post.hired_professional_id ? null : <button disabled={actionBusy} onClick={() => void changeStatus(post.status === 'closed' ? 'open' : 'closed')} type="button">{post.status === 'closed' ? 'Reopen request' : 'Close request'}</button>}{!post.hired_professional_id && <button onClick={() => setRemoveOpen(true)} type="button">Remove request</button>}</div></details>}</nav>
      <div className={`post-detail__layout${post.images.length ? ' has-gallery' : ''}`}>
      {post.images.length === 0 && <section aria-label="No photos added to this request" className="post-detail__no-gallery"><div><Wrench aria-hidden="true" weight="light" /><span>{post.service_categories?.name || 'Service request'}</span></div></section>}
      {post.status === 'completed' && <section aria-label="Before and after completed work" className="post-gallery post-gallery--comparison"><BeforeAfterSlider after={post.images.filter((image) => image.kind === 'after').map((image) => ({ ...image, url: imageUrls[image.storage_path] }))} before={post.images.filter((image) => image.kind === 'before').map((image) => ({ ...image, url: imageUrls[image.storage_path] }))} title={post.title} /></section>}
      {post.status !== 'completed' && post.images.length > 0 && (
        <section aria-label="Post photos" className="post-gallery">
          <div className="post-gallery__track" onScroll={(event) => setActivePhoto(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}>
            {post.images.map((image, index) => imageUrls[image.storage_path] ? (
              <figure className="post-gallery__slide" key={image.storage_path}>
                <img alt={`${post.title}, photo ${index + 1}`} onError={() => hideMissingImage(image.storage_path)} src={imageUrls[image.storage_path]} />
              </figure>
            ) : null)}
          </div>
          <div aria-hidden="true" className="post-gallery__dots">
            {post.images.filter(({ storage_path }) => imageUrls[storage_path]).map((image, index) => <span className={index === activePhoto ? 'is-active' : ''} key={image.storage_path} />)}
          </div>
        </section>
      )}
        <article className="post-detail__content">
        <div className="post-detail__eyebrows">
          {post.service_categories?.name && <span className="post-card__category">{post.service_categories.name}</span>}
          {post.status !== 'open' && <Badge tone={post.hired_professional_id ? 'success' : 'neutral'}>{post.hired_professional_id ? 'Professional hired' : post.status === 'closed' ? 'Closed' : 'Removed'}</Badge>}
        </div>
        <h1>{post.title}</h1>
        <p className="post-detail__budget">{formatPostBudget(post)}{post.negotiable && post.budget_type === 'range' ? ' · Negotiable' : ''}</p>
        <div className="post-detail__meta">
          {location && <span><MapPin aria-hidden="true" size={18} />{location}</span>}
          <span><CalendarBlank aria-hidden="true" size={18} />{timing}</span>
          <span><CalendarBlank aria-hidden="true" size={18} />{scheduleLabel}</span>
          <span><Wrench aria-hidden="true" size={18} />{post.job_type.replaceAll('_', ' ')}</span>
        </div>
        {post.status === 'completed' && <section className="completed-post-paid"><span>Paid</span><strong>{formatNaira(post.final_price_naira)}</strong></section>}
        <section className="post-detail__section">
          <h2>{post.status === 'completed' ? 'The problem' : 'Details'}</h2>
          <p className="post-detail__description">{post.description}</p>
        </section>
        <section className="post-detail__author">
          <Avatar name={post.authorName || 'Fixora member'} size={44} src={avatarUrl(post.authorAvatarPath)} />
          <div><span>Posted by</span><strong>{post.authorName || 'Fixora member'}</strong></div>
          <time>{formatRelativeTime(post.created_at)}</time>
        </section>
        {post.status === 'completed' && <section className="completed-post-professional"><h2>Fixed by</h2><Link className="completed-post-provider" to={`/app/professionals/${post.hired_professional_id}`}><Avatar name={completion?.provider?.display_name || 'Professional'} size={48} src={avatarUrl(completion?.provider?.avatar_path)} presence={isOnline(post.hired_professional_id)} /><div><strong>{completion?.provider?.display_name || 'Fixora professional'}</strong>{completion?.provider?.provider_type && <ProviderTypeBadge compact type={completion.provider.provider_type} />}{Number(completion?.rating?.review_count) > 0 ? <span className="completed-post-rating"><Star aria-hidden="true" size={15} weight="fill" />{Number(completion.rating.average_rating).toFixed(1)} · {completion.rating.review_count} {Number(completion.rating.review_count) === 1 ? 'review' : 'reviews'}</span> : <span>No reviews yet</span>}</div></Link>{completion?.review && <div className="completed-post-review"><div className="completed-post-review__head"><strong>{completion.review.customer_display_name}</strong><time>{new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(completion.review.created_at))}</time></div><ReviewStars rating={completion.review.rating} />{completion.review.comment && <p>{completion.review.comment}</p>}</div>}<div className="completed-post-details">{post.service_categories?.name && <span>{post.service_categories.name}</span>}{location && <span>{location}</span>}{post.completed_at && <span>Completed {new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(post.completed_at))}</span>}</div></section>}
        {post.author_id === user?.id && post.status !== 'removed' && post.status !== 'completed' && <div className="post-detail__owner-actions">
          <Button as={Link} to={`/app/posts/${post.id}/edit`} variant="secondary">Edit</Button>
          {post.status === 'closed' && post.hired_professional_id && <Button as={Link} to={`/app/posts/${post.id}/complete`} variant="primary">Mark as completed</Button>}
          {!post.hired_professional_id && post.status !== 'removed' && <Button disabled={actionBusy} onClick={() => void changeStatus(post.status === 'closed' ? 'open' : 'closed')} variant="secondary">{post.status === 'closed' ? 'Reopen' : 'Close'}</Button>}
          {post.status !== 'removed' && !post.hired_professional_id && <Button disabled={actionBusy} onClick={() => setRemoveOpen(true)} variant="secondary">Remove</Button>}
          {post.published_at && <Button as={Link} to={`/app/posts/${post.id}/applicants`} variant="primary">Applicants · {applicationCount}</Button>}
        </div>}
        {FEATURES.chat && post.hired_professional_id && post.status !== 'removed'
          && (post.author_id === user?.id || post.hired_professional_id === user?.id)
          && <Button as={Link} to={`/app/messages?postId=${post.id}`} variant="primary">Message</Button>}
        {post.status !== 'completed' && post.author_id !== user?.id && profile?.account_type === 'provider' && <section aria-label="Your application" className="post-application-panel">
          {application ? <>
            <div className="post-application-panel__heading"><h2>Your application</h2><Badge tone={application.status === 'hired' ? 'success' : application.status === 'pending' ? 'info' : 'neutral'}>{({ pending: 'Pending', hired: 'Selected', not_selected: 'Not selected', withdrawn: 'Withdrawn' })[application.status]}</Badge></div>
            {application.message && <p>{application.message}</p>}
            {application.status === 'pending' && post.status === 'open' && <Button disabled={actionBusy} onClick={() => void withdrawApplication()} variant="secondary">Withdraw application</Button>}
          </> : post.status === 'open' && post.published_at && providerPublished ? <>
            <h2>Apply to this request</h2>
            <label className="ui-field" htmlFor="application-message"><span className="ui-field__label">Short message <small>(optional)</small></span><textarea id="application-message" maxLength={1000} onChange={(event) => setApplicationMessage(event.target.value)} placeholder="Share how you can help with this work." rows={3} value={applicationMessage} /></label>
            <Button disabled={actionBusy} loading={actionBusy} onClick={() => void applyToPost()}>Send application</Button>
          </> : post.status === 'open' && post.published_at ? <><h2>Publish your professional profile to apply</h2><p>Customers need to see your services and service areas before they can review an application.</p></> : <><h2>Applications closed</h2><p>This request is no longer accepting applications.</p></>}
        </section>}
      </article>
      </div>
      <div className="post-detail__mobile-action">
        {post.author_id === user?.id && post.status === 'closed' && post.hired_professional_id && <Button as={Link} to={`/app/posts/${post.id}/complete`}>Mark as completed</Button>}
        {post.author_id === user?.id && post.status === 'open' && <Button as={Link} to={`/app/posts/${post.id}/applicants`}>View applicants ({applicationCount})</Button>}
        {post.author_id !== user?.id && profile?.account_type === 'provider' && post.status === 'open' && post.published_at && providerPublished && !application && <Button onClick={() => document.querySelector('.post-application-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Apply</Button>}
        {FEATURES.chat && post.hired_professional_id && post.status !== 'removed' && (post.author_id === user?.id || post.hired_professional_id === user?.id) && <Button as={Link} to={`/app/messages?postId=${post.id}`} variant={post.author_id === user?.id && post.status === 'closed' ? 'secondary' : 'primary'}>Message</Button>}
      </div>
      <ActionSheet busy={actionBusy} confirmLabel="Remove post" description="This removes the post from Fixora. Its photos remain stored." onCancel={() => setRemoveOpen(false)} onConfirm={() => { setRemoveOpen(false); void changeStatus('removed') }} open={removeOpen} title="Remove this post?" />
    </main>
  )
}
