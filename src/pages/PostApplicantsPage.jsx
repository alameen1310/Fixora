import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Star } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import { ActionSheet, Avatar, Badge, Button, Skeleton } from '../components/UiPrimitives.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchPostApplications, markPostApplicationActivitiesRead } from '../lib/applicationQueries.js'
import { fetchProblemPost } from '../lib/postQueries.js'
import { formatNaira, formatPostBudget } from '../lib/postQueries.js'
import PostThumb from '../components/PostThumb.jsx'
import { supabase } from '../lib/supabase.js'
import { avatarUrl } from '../lib/avatarImages.js'
import { appQueryCache } from '../lib/postListCache.js'
import { usePresence } from '../components/PresenceProvider.jsx'
import '../components/Posts.css'
import './PostApplicantsPage.css'

export default function PostApplicantsPage() {
  const { postId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isOnline, refreshPresence } = usePresence()
  const [post, setPost] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [hiring, setHiring] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchProblemPost(postId)
      if (!result || result.author_id !== user?.id) {
        setPost(null)
        setApplications([])
        return
      }
      setPost(result)
      const loadedApplications = await fetchPostApplications(postId)
      setApplications(loadedApplications)
      if (user?.id) {
        try {
          await markPostApplicationActivitiesRead(postId, user.id)
          const cacheKey = `${user.id}:activity:customer`
          const cachedActivity = appQueryCache.get(cacheKey)
          if (cachedActivity) {
            const readAt = new Date().toISOString()
            appQueryCache.set(cacheKey, {
              ...cachedActivity,
              items: cachedActivity.items.map((item) => item.post_id === postId && item.kind === 'application_received' && !item.read_at ? { ...item, read_at: readAt } : item),
            })
          }
        } catch (readError) {
          console.error('[activity-read]', { postId, code: readError?.code, message: readError?.message })
        }
      }
      void refreshPresence(loadedApplications.map((application) => application.professional_id))
    } catch {
      setError('We couldn’t load the applicants. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [postId, refreshPresence, user?.id])

  useEffect(() => { void load() }, [load])

  async function hire() {
    if (!selected || hiring) return
    setHiring(true)
    const { data: hireResult, error: hireError } = await supabase.rpc('hire_problem_professional', {
      requested_post_id: postId,
      requested_application_id: selected.id,
    })
    setHiring(false)
    if (hireError) {
      console.error('[marketplace-write]', { step: 'hire', postId, code: hireError.code, message: hireError.message })
      showToast({ type: 'error', message: hireError.message?.includes('no longer') ? 'This request has changed. Refresh the applicants and try again.' : 'Could not hire this professional. Please try again.' })
      setSelected(null)
      return
    }
    const outcome = hireResult?.outcome || hireResult?.[0]?.outcome
    const outcomeMessages = {
      conflict: 'This professional has another job at an overlapping time. Their application remains visible; choose another available applicant.',
      availability_unknown: 'We can’t confirm this professional’s schedule because another active job has no confirmed time. Please choose another applicant or agree on availability first.',
      active_job_near_term: 'This professional has an unfinished job and can only be hired for flexible work or a request scheduled at least 7 days from today.',
      busy: 'This professional is not accepting new work right now. Their application remains visible.',
      invalid_schedule: 'Confirm this request’s start and end time before hiring.',
      already_hired: 'This request has already been hired. Refresh the applicant list.',
      application_changed: 'This application has changed. Refresh the applicant list.',
      provider_ineligible: 'This professional is no longer eligible for this request.',
    }
    if (outcome !== 'hired') {
      showToast({ type: 'error', message: outcomeMessages[outcome] || 'We couldn’t confirm the hire. Refresh applicants and try again.' })
      setSelected(null)
      await load()
      return
    }
    setSelected(null)
    showToast({ type: 'success', message: 'Professional hired.' })
    await load()
  }

  if (loading) return <main className="app-page applicants-page"><Skeleton style={{ height: '3rem', marginBottom: 16 }} /><Skeleton style={{ height: '12rem' }} /></main>
  if (error) return <main className="app-page applicants-page"><section className="posts-feed__error" role="alert"><h1>Applicants unavailable</h1><p>{error}</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section></main>
  if (!post) return <main className="app-page applicants-page"><section className="app-unavailable-state"><h1>Request not found</h1><p>This request is unavailable or you do not have access.</p><Button as={Link} to="/app/my-posts" variant="secondary">Back to My Posts</Button></section></main>

  const pendingCount = applications.filter((application) => application.status === 'pending').length
  const scheduleConfirmed = post.schedule_mode === 'confirmed' && post.scheduled_start_at && post.scheduled_end_at && new Date(post.scheduled_end_at) > new Date(post.scheduled_start_at)
  const scheduleSummary = scheduleConfirmed
    ? `${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(post.scheduled_start_at))} – ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(post.scheduled_end_at))} WAT`
    : 'Not confirmed'
  return (
    <main className="app-page applicants-page">
      <Link className="app-back-link post-detail__back" to={`/app/posts/${postId}`}><ArrowLeft aria-hidden="true" size={19} />Back to request</Link>
      <header className="applicants-page__title"><div><h1>Applicants</h1><Badge tone="neutral">{applications.length} {applications.length === 1 ? 'applicant' : 'applicants'}</Badge></div></header>
      <section className="applicants-request-summary">
        <span className="applicants-request-summary__image"><PostThumb category={post.service_categories} path={post.coverPath} /></span>
        <div className="applicants-request-summary__text"><strong>{post.title}</strong><span>{post.service_categories?.name || 'Service request'} · {formatPostBudget(post)}</span></div>
        <Badge tone={post.hired_professional_id ? 'success' : post.status === 'open' ? 'info' : 'neutral'}>{post.hired_professional_id ? 'Hired' : post.status === 'open' ? 'Open' : 'Closed'}</Badge>
      </section>
      <section className={`applicant-schedule-note${scheduleConfirmed ? '' : ' is-unconfirmed'}`}><span><strong>{scheduleConfirmed ? `Work time: ${scheduleSummary}` : 'Work time not confirmed'}</strong><span>{scheduleConfirmed ? 'Availability is checked again when you hire.' : 'Confirm a time so Fixora can check schedule overlaps.'}</span></span>{post.status === 'open' && <Button as={Link} to={`/app/posts/${postId}/edit`} variant="secondary">{scheduleConfirmed ? 'Change time' : 'Set work time'}</Button>}</section>
      <div className="applicants-layout">
        {applications.length === 0 ? <section className="applicants-empty"><MarketplaceDoodle /><div><h2>No applications yet</h2><p>Professionals can apply while this request is open.</p></div></section> : <section aria-label="Applications" className="applicants-list">
            {applications.map((application) => {
              const provider = application.professional
              const services = (provider?.provider_service_categories ?? []).map((item) => item.category?.name).filter(Boolean)
              const shownServices = services.slice(0, 4)
              const areas = (provider?.provider_service_areas ?? []).map((item) => [item.city, item.region].filter(Boolean).join(', ')).filter(Boolean)
              const availabilityLabel = { unavailable: 'Unavailable for this time', unknown: 'Availability unconfirmed', busy: 'Not accepting work', active_job: 'Has an unfinished job' }[application.availability]
              const isUnavailable = application.status === 'pending' && ['unavailable', 'unknown', 'busy', 'active_job'].includes(application.availability)
              const isWorking = application.status === 'pending' && application.availability === 'working'
              const label = application.status === 'pending' && !scheduleConfirmed ? 'Schedule unconfirmed' : isUnavailable ? availabilityLabel : { pending: 'Pending', hired: 'Hired', not_selected: 'Not selected', withdrawn: 'Withdrawn' }[application.status]
              return (
                <article className={`applicant-card${isUnavailable ? ' is-unavailable' : ''}`} key={application.id}>
                  <div className="applicant-card__head">
                    <Avatar name={provider?.display_name || 'Professional'} size={56} src={avatarUrl(provider?.avatar_path)} presence={isOnline(application.professional_id)} />
                    <div className="applicant-card__identity"><h2>{provider?.display_name || 'Professional profile unavailable'}</h2>{Number(provider?.rating?.review_count) > 0 ? <span className="applicant-card__rating"><Star aria-hidden="true" size={14} weight="fill" />{Number(provider.rating.average_rating).toFixed(1)} ({provider.rating.review_count})</span> : <span className="applicant-card__rating applicant-card__rating--empty">No reviews yet</span>}</div>
                    <Badge tone={application.status === 'hired' ? 'success' : application.status === 'pending' && !isUnavailable && scheduleConfirmed ? 'info' : 'neutral'}>{label}</Badge>
                  </div>
                  {provider && <span className={`applicant-card__availability${provider.availability === 'busy' ? ' is-busy' : ''}`}>{provider.availability === 'busy' ? 'Not accepting work' : isWorking ? 'Working another job' : 'Available'}</span>}
                  {isWorking && <p className="applicant-card__work-warning" role="note">This professional has an unfinished job. Their schedule does not overlap this request, but confirm they can take it on before hiring.</p>}
                  {shownServices.length > 0 && <div className="applicant-card__service-chips">{shownServices.map((service) => <span key={service}>{service}</span>)}{services.length > 4 && <span>+{services.length - 4}</span>}</div>}
                  {areas.length > 0 && <p className="applicant-card__services"><MapPin aria-hidden="true" size={16} />{areas.join(' · ')}</p>}
                  {provider?.service_description && <p className="applicant-card__description">{provider.service_description}</p>}
                  {application.message && <blockquote className="applicant-card__message">“{application.message}”</blockquote>}
                  {application.quote_naira && <strong className="applicant-card__quote">Quote: {formatNaira(application.quote_naira)}</strong>}
                  <div className="applicant-card__actions">
                    {provider && <Button as={Link} to={`/app/professionals/${provider.profile_id}`} variant="secondary">View profile</Button>}
                    {post.status === 'open' && application.status === 'pending' && scheduleConfirmed && ['available', 'working'].includes(application.availability) && <Button onClick={() => setSelected(application)}>Hire professional</Button>}
                  </div>
                </article>
              )
            })}
          </section>}
          <aside className="applicants-summary">
            <span className="app-eyebrow">Request status</span>
            <strong>{post.hired_professional_id ? 'Professional selected' : post.status === 'open' ? 'Open for applications' : 'Closed'}</strong>
            <p>{post.hired_professional_id ? 'Your request is now assigned. Applicants have received their status.' : `${pendingCount} pending ${pendingCount === 1 ? 'application' : 'applications'}.`}</p>
            <Link to={`/app/posts/${postId}`}>View request</Link>
          </aside>
      </div>
      <ActionSheet busy={hiring} confirmLabel="Hire this professional" description={`${selected?.quote_naira ? `Hire at ${formatNaira(selected.quote_naira)}. ` : ''}${selected?.availability === 'working' ? 'This professional is currently completing another job. You can still hire them for this request, but confirm they can take on both commitments. ' : ''}This closes the request and marks other pending applications as not selected. Work time: ${scheduleSummary}. Availability is checked again before the hire is saved.`} onCancel={() => setSelected(null)} onConfirm={() => void hire()} open={Boolean(selected)} title={selected?.quote_naira ? `Hire at ${formatNaira(selected.quote_naira)}?` : selected?.availability === 'working' ? 'Hire while they’re working?' : 'Confirm hire?'} />
    </main>
  )
}
