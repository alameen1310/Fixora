import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Star, Wrench } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import { ActionSheet, Avatar, Badge, Button, ProviderTypeBadge, Skeleton } from '../components/UiPrimitives.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchPostApplications } from '../lib/applicationQueries.js'
import { fetchProblemPost } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'
import { avatarUrl } from '../lib/avatarImages.js'
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
      <header className="app-page__heading applicants-heading">
        <span className="app-eyebrow">Applicants · {applications.length}</span>
        <h1 className="text-large-title">People ready to help</h1>
        <p>{post.title}</p>
      </header>
      <section className={`applicant-schedule-note${scheduleConfirmed ? '' : ' is-unconfirmed'}`}><div><strong>Work time: {scheduleSummary}</strong><p>{scheduleConfirmed ? 'Availability was checked against these dates. The server checks again when you hire.' : 'Confirm a start and end time before hiring so Fixora can check real schedule overlaps.'}</p></div>{!scheduleConfirmed && post.status === 'open' && <Button as={Link} to={`/app/posts/${postId}/edit`} variant="secondary">Edit schedule</Button>}</section>
      {applications.length === 0 ? (
        <section className="applicants-empty">
          <MarketplaceDoodle />
          <div><h2>No applications yet</h2><p>Professionals can apply while this request is open.</p></div>
        </section>
      ) : (
        <div className="applicants-layout">
          <section aria-label="Applications" className="applicants-list">
            {applications.map((application) => {
              const provider = application.professional
              const services = (provider?.provider_service_categories ?? []).map((item) => item.category?.name).filter(Boolean)
              const areas = (provider?.provider_service_areas ?? []).map((item) => [item.city, item.region].filter(Boolean).join(', ')).filter(Boolean)
              const availabilityLabel = { unavailable: 'Unavailable for this time', unknown: 'Availability unconfirmed', busy: 'Not accepting work' }[application.availability]
              const isUnavailable = application.status === 'pending' && ['unavailable', 'unknown', 'busy'].includes(application.availability)
              const label = application.status === 'pending' && !scheduleConfirmed ? 'Schedule unconfirmed' : isUnavailable ? availabilityLabel : { pending: 'Pending', hired: 'Hired', not_selected: 'Not selected', withdrawn: 'Withdrawn' }[application.status]
              return (
                <article className={`applicant-card${isUnavailable ? ' is-unavailable' : ''}`} key={application.id}>
                  <div className="applicant-card__head">
                    <Avatar name={provider?.display_name || 'Professional'} size={52} src={avatarUrl(provider?.avatar_path)} presence={isOnline(application.professional_id)} />
                    <div className="applicant-card__identity"><h2>{provider?.display_name || 'Professional profile unavailable'}</h2>{provider && <ProviderTypeBadge compact type={provider.provider_type} />}{provider && <Badge tone={provider.availability === 'busy' ? 'neutral' : 'success'}>{provider.availability === 'busy' ? 'Busy' : 'Available'}</Badge>}{Number(provider?.rating?.review_count) > 0 && <span className="applicant-card__rating"><Star aria-hidden="true" size={14} weight="fill" />{Number(provider.rating.average_rating).toFixed(1)} ({provider.rating.review_count})</span>}</div>
                    <Badge tone={application.status === 'hired' ? 'success' : application.status === 'pending' && !isUnavailable && scheduleConfirmed ? 'info' : 'neutral'}>{label}</Badge>
                  </div>
                  {services.length > 0 && <p className="applicant-card__services"><Wrench aria-hidden="true" size={16} />{services.join(' · ')}</p>}
                  {areas.length > 0 && <p className="applicant-card__services"><MapPin aria-hidden="true" size={16} />{areas.join(' · ')}</p>}
                  {provider?.service_description && <p className="applicant-card__description">{provider.service_description}</p>}
                  {application.message && <blockquote className="applicant-card__message">“{application.message}”</blockquote>}
                  <div className="applicant-card__actions">
                    {provider && <Button as={Link} to={`/app/professionals/${provider.profile_id}`} variant="secondary">View profile</Button>}
                    {post.status === 'open' && application.status === 'pending' && scheduleConfirmed && application.availability === 'available' && <Button onClick={() => setSelected(application)}>Hire professional</Button>}
                  </div>
                </article>
              )
            })}
          </section>
          <aside className="applicants-summary">
            <span className="app-eyebrow">Request status</span>
            <strong>{post.hired_professional_id ? 'Professional selected' : post.status === 'open' ? 'Open for applications' : 'Closed'}</strong>
            <p>{post.hired_professional_id ? 'Your request is now assigned. Applicants have received their status.' : `${pendingCount} pending ${pendingCount === 1 ? 'application' : 'applications'}.`}</p>
            <Link to={`/app/posts/${postId}`}>View request</Link>
          </aside>
        </div>
      )}
      <ActionSheet busy={hiring} confirmLabel="Hire this professional" description={`This closes the request and marks other pending applications as not selected. Work time: ${scheduleSummary}. Availability is checked again before the hire is saved.`} onCancel={() => setSelected(null)} onConfirm={() => void hire()} open={Boolean(selected)} title="Confirm hire?" />
    </main>
  )
}
