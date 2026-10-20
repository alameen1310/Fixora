import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Bell, ChatCircleDots, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, EmptyState, Skeleton } from '../components/UiPrimitives.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import MarketplaceRail from '../components/MarketplaceRail.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchMarketplaceActivities, fetchProviderApplications, markMarketplaceActivityRead } from '../lib/applicationQueries.js'
import { formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { FEATURES } from '../config/features.js'
import './ActivityPage.css'
import './AuthenticatedPages.css'

function activityMessage(activity, isProvider) {
  const title = activity.problem_posts?.title || 'your request'
  if (activity.kind === 'application_received') return <><strong>{activity.actorName || 'A professional'}</strong> applied to <strong>{title}</strong>.</>
  if (activity.kind === 'application_hired') return <>You were selected for <strong>{title}</strong>.</>
  if (activity.kind === 'application_not_selected') return <>Your application for <strong>{title}</strong> was not selected.</>
  if (activity.kind === 'post_hired') return <>You hired a professional for <strong>{title}</strong>.</>
  if (activity.kind === 'post_completed') return <>You marked <strong>{title}</strong> as completed.</>
  return isProvider ? <>Your application for <strong>{title}</strong> is pending.</> : <>There’s an update for <strong>{title}</strong>.</>
}

export default function ActivityPage() {
  const { user, profile } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [segment, setSegment] = useState('applied')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try { setItems(isProvider ? await fetchProviderApplications(user.id) : await fetchMarketplaceActivities(user.id)) }
    catch { setError(true) }
    finally { setLoading(false) }
  }, [isProvider, user.id])

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

  const customerActivityGroups = [
    ['New applications', items.filter((item) => item.kind === 'application_received')],
    ['Hired', items.filter((item) => item.kind === 'post_hired')],
    ['Completed', items.filter((item) => item.kind === 'post_completed')],
    ['Earlier', items.filter((item) => !['application_received', 'post_hired', 'post_completed'].includes(item.kind))],
  ]

  return (
    <main className="app-page app-page--activity">
      <header className="app-page__heading activity-heading">
        <h1 className="text-large-title">Activity</h1>
        <p>Updates on requests and applications.</p>
      </header>
      {isProvider && <nav aria-label="Application status" className="provider-activity-tabs">
        {[
          ['applied', 'Applied', (item) => item.status === 'pending' && item.post?.status === 'open'],
          ['selected', 'Selected', (item) => item.status === 'hired' || item.post?.hired_professional_id === user.id],
          ['declined', 'Declined', (item) => item.status === 'not_selected' || (item.status === 'pending' && ['closed', 'removed'].includes(item.post?.status))],
        ].map(([key, label, predicate]) => <button aria-pressed={segment === key} className="provider-activity-tabs__button" key={key} onClick={() => setSegment(key)} type="button">{label}<span>{items.filter(predicate).length}</span></button>)}
      </nav>}
      {loading ? <div className="activity-list" aria-label="Loading activity" role="status">{[0, 1, 2].map((item) => <Skeleton className="activity-skeleton" key={item} />)}</div>
        : error ? <section className="posts-feed__error" role="alert"><h2>Activity didn’t load</h2><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section>
          : isProvider ? (() => {
            const predicates = {
              applied: (item) => item.status === 'pending' && item.post?.status === 'open',
              selected: (item) => item.status === 'hired' || item.post?.hired_professional_id === user.id,
              declined: (item) => item.status === 'not_selected' || (item.status === 'pending' && ['closed', 'removed'].includes(item.post?.status)),
            }
            const selectedItems = items.filter(predicates[segment])
            return selectedItems.length === 0
              ? <section className="activity-empty"><MarketplaceDoodle className="activity-empty__doodle" /><EmptyState action={<Button as={Link} to="/app" variant="secondary">Browse open requests <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message="Open requests from customers will appear on Home." title={`No ${segment} applications`} /></section>
              : <section aria-label={`${segment} applications`} className="activity-list provider-activity-list">{selectedItems.map((item) => {
                const post = item.post
                const selected = item.status === 'hired' || post.hired_professional_id === user.id
                const declined = !selected && (item.status === 'not_selected' || ['closed', 'removed'].includes(post.status))
                const newActivity = item.activity && !item.activity.read_at
                const statusLabel = selected ? post.status === 'completed' ? 'Completed' : 'In progress' : declined ? 'Declined' : 'Applied'
                const to = `/app/posts/${post.id}`
                return <article className={`provider-application-card${declined ? ' is-declined' : ''}`} key={item.id}>
                  <Link className="provider-application-card__main" to={to}>
                    <div className="provider-application-card__top"><div><span className="post-card__category">{post.service_categories?.name || 'Service request'}</span><h2>{post.title}</h2></div><div className="provider-application-card__status">{newActivity && <span aria-label="New update" className="provider-application-card__new" />}<ArrowRight aria-hidden="true" size={18} /></div></div>
                    <p className="provider-application-card__budget">{formatPostBudget(post)}</p>
                    <div className="provider-application-card__meta"><span>{[post.city, post.region].filter(Boolean).join(', ') || 'Location not specified'}</span><span>Customer: {item.customerName}</span></div>
                    {item.message && <p className="provider-application-card__quote">“{item.message}”</p>}
                    <div className="provider-application-card__foot"><Badge tone={selected ? 'success' : declined ? 'neutral' : 'info'}>{statusLabel}</Badge><time>{formatRelativeTime(item.activity?.created_at || item.updated_at || item.created_at)}</time></div>
                  </Link>
                  {selected && FEATURES.chat && <Button as={Link} to={`/app/messages?postId=${post.id}`} variant="primary">Message</Button>}
                </article>
              })}</section>
          })() : items.length === 0 ? <section className="activity-empty"><MarketplaceDoodle className="activity-empty__doodle" /><EmptyState action={<Button as={Link} to="/app/discover" variant="secondary">Discover professionals <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message="When a professional applies or a customer makes a decision, updates will appear here." title="No activity yet" /></section>
            : <div className="activity-layout">
              <section aria-label="Recent activity" className="activity-list">
                {(isProvider ? ['New', 'Earlier'].map((group) => [group, items.filter((item) => group === 'New' ? !item.read_at : Boolean(item.read_at))]) : customerActivityGroups).map(([group, groupedItems]) => {
                  if (!groupedItems.length) return null
                  return <div className="activity-group" key={group}><h2>{group}</h2>{groupedItems.map((item) => {
                  const target = item.kind === 'application_received' && item.problem_posts?.id
                    ? `/app/posts/${item.post_id}/applicants`
                    : `/app/posts/${item.post_id}`
                  return <article className={`activity-item${item.read_at ? '' : ' is-unread'}`} key={item.id}>
                    <span className="activity-item__icon">{item.kind === 'application_received' ? <ClockCounterClockwise aria-hidden="true" size={20} /> : <CheckCircle aria-hidden="true" size={20} />}</span>
                    {item.kind === 'application_received' && <Avatar name={item.actorName || 'Professional'} size={40} />}
                    <div className="activity-item__body"><p>{activityMessage(item, isProvider)}</p><time>{new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time></div>
                    <div className="activity-item__actions">
                      {FEATURES.chat && ['post_hired', 'post_completed'].includes(item.kind) && <Link aria-label="Message the hired professional" className="activity-message-action" to={`/app/messages?postId=${item.post_id}`}><ChatCircleDots aria-hidden="true" size={17} /><span>Message</span></Link>}
                      {!item.read_at && <button aria-label="Mark as read" className="activity-read-button" onClick={() => void markRead(item)} title="Mark as read" type="button"><span /></button>}
                      <Link aria-label="Open related request" to={target}><ArrowRight aria-hidden="true" size={19} /></Link>
                    </div>
                  </article>
                  })}</div>
                })}
              </section>
              {!isProvider && <MarketplaceRail userId={user.id} />}
            </div>}
    </main>
  )
}
