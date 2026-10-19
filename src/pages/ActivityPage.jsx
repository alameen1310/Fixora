import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Bell, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar, Button, EmptyState, Skeleton } from '../components/UiPrimitives.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchMarketplaceActivities, markMarketplaceActivityRead } from '../lib/applicationQueries.js'
import './ActivityPage.css'
import './AuthenticatedPages.css'

function activityMessage(activity, isProvider) {
  const title = activity.problem_posts?.title || 'your request'
  if (activity.kind === 'application_received') return <><strong>{activity.actorName || 'A professional'}</strong> applied to <strong>{title}</strong>.</>
  if (activity.kind === 'application_hired') return <>You were selected for <strong>{title}</strong>.</>
  if (activity.kind === 'application_not_selected') return <>Your application for <strong>{title}</strong> was not selected.</>
  return isProvider ? <>Your application for <strong>{title}</strong> is pending.</> : <>There’s an update for <strong>{title}</strong>.</>
}

export default function ActivityPage() {
  const { user, profile } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try { setItems(await fetchMarketplaceActivities(user.id)) }
    catch { setError(true) }
    finally { setLoading(false) }
  }, [user.id])

  useEffect(() => { void load() }, [load])

  async function markRead(item) {
    if (item.read_at) return
    try {
      await markMarketplaceActivityRead(item.id, user.id)
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry))
    } catch {
      setError(true)
    }
  }

  return (
    <main className="app-page app-page--activity">
      <header className="app-page__heading activity-heading">
        <span className="app-eyebrow">Your marketplace</span>
        <h1 className="text-large-title">Activity</h1>
        <p>Updates on requests and applications.</p>
      </header>
      {loading ? <div className="activity-list" aria-label="Loading activity" role="status">{[0, 1, 2].map((item) => <Skeleton className="activity-skeleton" key={item} />)}</div>
        : error ? <section className="posts-feed__error" role="alert"><h2>Activity didn’t load</h2><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section>
          : items.length === 0 ? <section className="activity-empty"><MarketplaceDoodle className="activity-empty__doodle" /><EmptyState action={<Button as={Link} to="/app/discover" variant="secondary">{isProvider ? 'Browse requests' : 'Discover professionals'} <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message="When a professional applies or a customer makes a decision, updates will appear here." title="No activity yet" /></section>
            : <div className="activity-layout">
              <section aria-label="Recent activity" className="activity-list">
                {items.map((item) => {
                  const target = item.kind === 'application_received' && item.problem_posts?.id
                    ? `/app/posts/${item.post_id}/applicants`
                    : `/app/posts/${item.post_id}`
                  return <article className={`activity-item${item.read_at ? '' : ' is-unread'}`} key={item.id}>
                    <span className="activity-item__icon">{item.kind === 'application_received' ? <ClockCounterClockwise aria-hidden="true" size={20} /> : <CheckCircle aria-hidden="true" size={20} />}</span>
                    {item.kind === 'application_received' && <Avatar name={item.actorName || 'Professional'} size={40} />}
                    <div className="activity-item__body"><p>{activityMessage(item, isProvider)}</p><time>{new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time></div>
                    <div className="activity-item__actions">
                      {!item.read_at && <button aria-label="Mark as read" className="activity-read-button" onClick={() => void markRead(item)} title="Mark as read" type="button"><span /></button>}
                      <Link aria-label="Open related request" to={target}><ArrowRight aria-hidden="true" size={19} /></Link>
                    </div>
                  </article>
                })}
              </section>
              <aside className="activity-rail"><span className="app-eyebrow">Next step</span><h2>{isProvider ? 'Keep your profile current' : 'Stay close to your requests'}</h2><p>{isProvider ? 'Clear services and service areas help customers understand your work.' : 'Review applications from the request detail page when they arrive.'}</p><Link to={isProvider ? '/app/profile' : '/app/my-posts'}>{isProvider ? 'View profile' : 'View My Posts'} <ArrowRight aria-hidden="true" size={16} /></Link></aside>
            </div>}
    </main>
  )
}
