import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Star, Wrench } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import { ActionSheet, Avatar, Badge, Button, Skeleton } from '../components/UiPrimitives.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchPostApplications } from '../lib/applicationQueries.js'
import { fetchProblemPost } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'
import '../components/Posts.css'
import './PostApplicantsPage.css'

export default function PostApplicantsPage() {
  const { postId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [post, setPost] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [hiring, setHiring] = useState(false)
  const [availabilityById, setAvailabilityById] = useState({})

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
      const applicationRows = await fetchPostApplications(postId)
      setApplications(applicationRows)
      const { data: availabilityRows, error: availabilityError } = await supabase.rpc('get_post_application_availability', { requested_post_id: postId })
      if (availabilityError) throw availabilityError
      setAvailabilityById(Object.fromEntries((availabilityRows ?? []).map((row) => [row.application_id, row.availability])))
    } catch {
      setError('We couldn’t load the applicants. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [postId, user?.id])

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
    const outcomes = {
      already_hired: 'This request has already been assigned. Refresh the page to see the latest status.',
      invalid_schedule: 'Add a confirmed start and end time to this request before hiring. Edit the request schedule and try again.',
      application_changed: 'This application changed. Refresh the applicants and try again.',
      provider_ineligible: 'This professional is no longer eligible for hiring.',
      availability_unknown: 'This professional has another job without a confirmed schedule. Ask them to confirm their availability before hiring.',
      conflict: 'This professional has another job scheduled during this time. Their application remains visible; choose someone else or adjust this schedule.',
    }
    if (hireResult?.outcome !== 'hired') {
      showToast({ type: 'error', duration: 0, message: outcomes[hireResult?.outcome] || 'Could not confirm this hire. Refresh the applicants and try again.' })
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
  return (
    <main className="app-page applicants-page">
      <Link className="app-back-link post-detail__back" to={`/app/posts/${postId}`}><ArrowLeft aria-hidden="true" size={19} />Back to request</Link>
      <header className="app-page__heading applicants-heading">
        <span className="app-eyebrow">Applicants · {applications.length}</span>
        <h1 className="text-large-title">People ready to help</h1>
        <p>{post.title}</p>
      </header>
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
              const availability = availabilityById[application.id] || (post.schedule_mode === 'confirmed' ? 'available' : 'schedule_required')
              const services = (provider?.provider_service_categories ?? []).map((item) => item.category?.name).filter(Boolean)
              const areas = (provider?.provider_service_areas ?? []).map((item) => [item.city, item.region].filter(Boolean).join(', ')).filter(Boolean)
              const label = { pending: 'Pending', hired: 'Hired', not_selected: 'Not selected', withdrawn: 'Withdrawn' }[application.status]
              return (
                <article className="applicant-card" key={application.id}>
                  <div className="applicant-card__head">
                    <Avatar name={provider?.display_name || 'Professional'} size={52} src={provider?.avatarUrl} />
                    <div className="applicant-card__identity"><h2>{provider?.display_name || 'Professional profile unavailable'}</h2><p>{provider?.provider_type === 'business' ? 'Service business' : 'Independent professional'}</p>{Number(provider?.rating?.review_count) > 0 && <span className="applicant-card__rating"><Star aria-hidden="true" size={14} weight="fill" />{Number(provider.rating.average_rating).toFixed(1)} ({provider.rating.review_count})</span>}</div>
                    <Badge tone={application.status === 'hired' ? 'success' : application.status === 'pending' ? 'info' : 'neutral'}>{label}</Badge>
                  </div>
                  {services.length > 0 && <p className="applicant-card__services"><Wrench aria-hidden="true" size={16} />{services.join(' · ')}</p>}
                  {areas.length > 0 && <p className="applicant-card__services"><MapPin aria-hidden="true" size={16} />{areas.join(' · ')}</p>}
                  {provider?.service_description && <p className="applicant-card__description">{provider.service_description}</p>}
                  {application.message && <blockquote className="applicant-card__message">“{application.message}”</blockquote>}
                  <div className="applicant-card__actions">
                    {provider && <Button as={Link} to={`/app/professionals/${provider.profile_id}`} variant="secondary">View profile</Button>}
                    {post.status === 'open' && application.status === 'pending' && availability === 'available' && <Button onClick={() => setSelected(application)}>Hire professional</Button>}
                    {post.status === 'open' && application.status === 'pending' && availability !== 'available' && <p className="applicant-availability" role="status">{availability === 'unavailable_time' ? 'No longer available for this time' : availability === 'availability_unknown' ? 'Availability needs confirmation' : 'Set a confirmed job schedule to check availability'}</p>}
                  </div>
                </article>
              )
            })}
          </section>
          <aside className="applicants-summary">
            <span className="app-eyebrow">Request status</span>
            <strong>{post.hired_professional_id ? 'Professional selected' : post.status === 'open' ? 'Open for applications' : 'Closed'}</strong>
            <p>{post.hired_professional_id ? 'Your request is now assigned. Applicants have received their status.' : `${pendingCount} pending ${pendingCount === 1 ? 'application' : 'applications'}.`}</p>
            {!post.hired_professional_id && post.schedule_mode !== 'confirmed' && <p className="applicants-schedule-note">Set a confirmed start and end time before hiring. Until then, provider availability cannot be checked.</p>}
            {!post.hired_professional_id && post.schedule_mode !== 'confirmed' && <Link to={`/app/posts/${postId}/edit`}>Add a confirmed schedule</Link>}
            <Link to={`/app/posts/${postId}`}>View request</Link>
          </aside>
        </div>
      )}
      <ActionSheet busy={hiring} confirmLabel="Hire this professional" description="Fixora will recheck the confirmed schedule and the professional’s other active jobs before accepting." onCancel={() => setSelected(null)} onConfirm={() => void hire()} open={Boolean(selected)} title="Confirm hire?" />
    </main>
  )
}
