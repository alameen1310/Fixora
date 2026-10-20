import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Bell, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Button, EmptyState, Skeleton } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import MarketplaceRail from '../components/MarketplaceRail.jsx'
import { fetchMarketplaceActivities, fetchProviderApplications, markMarketplaceActivityRead } from '../lib/applicationQueries.js'
import { formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { getPostImageUrl } from '../lib/postImages.js'
import { FEATURES } from '../config/features.js'
import './ActivityPage.css'
import './AuthenticatedPages.css'

function activityMessage(activity) {
  const title = activity.problem_posts?.title || 'your request'
  if (activity.kind === 'application_received') return <><strong>{activity.actorName || 'A professional'}</strong> applied to <strong>{title}</strong>.</>
  if (activity.kind === 'application_hired') return <>You were selected for <strong>{title}</strong>.</>
  if (activity.kind === 'application_not_selected') return <>Your application for <strong>{title}</strong> was not selected.</>
  if (activity.kind === 'post_hired') return <>You hired a professional for <strong>{title}</strong>.</>
  if (activity.kind === 'post_completed') return <>You marked <strong>{title}</strong> as completed.</>
  return <>There’s an update for <strong>{title}</strong>.</>
}

const predicatesFor = (userId) => ({
  applied: (item) => item.status === 'pending' && item.post?.status === 'open',
  selected: (item) => item.status === 'hired' || item.post?.hired_professional_id === userId,
  declined: (item) => item.status === 'not_selected' || (item.status === 'pending' && ['closed', 'removed'].includes(item.post?.status)),
})

export default function ActivityPage() {
  const { user, profile } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [segment, setSegment] = useState(() => ['applied', 'selected', 'declined'].includes(searchParams.get('segment')) ? searchParams.get('segment') : 'applied')
  const predicates = predicatesFor(user.id)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try { setItems(isProvider ? await fetchProviderApplications(user.id) : await fetchMarketplaceActivities(user.id)) }
    catch { setError(true) }
    finally { setLoading(false) }
  }, [isProvider, user.id])
  useEffect(() => { void load() }, [load])

  async function markRead(item) {
    if (item.read_at) return
    try { await markMarketplaceActivityRead(item.id, user.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)) }
    catch { setError(true) }
  }
  function selectSegment(next) { setSegment(next); const params = new URLSearchParams(searchParams); params.set('segment', next); setSearchParams(params, { replace: true }) }

  const groups = [
    ['New applications', items.filter((item) => item.kind === 'application_received')],
    ['Hired', items.filter((item) => item.kind === 'post_hired')],
    ['Completed', items.filter((item) => item.kind === 'post_completed')],
    ['Earlier', items.filter((item) => !['application_received', 'post_hired', 'post_completed'].includes(item.kind))],
  ]
  const counts = Object.fromEntries(Object.entries(predicates).map(([key, predicate]) => [key, items.filter(predicate).length]))
  const hiredCount = items.filter((item) => item.status === 'hired').length

  return <main className="app-page app-page--activity">
    <header className="app-page__heading activity-heading"><h1 className="text-large-title">Activity</h1></header>
    {isProvider ? <div className="provider-activity-layout">
      <section className="provider-activity-main">
        <nav aria-label="Application status" className="provider-activity-tabs">{[['applied', 'Applied'], ['selected', 'Selected'], ['declined', 'Declined']].map(([key, label]) => <button aria-pressed={segment === key} className="provider-activity-tabs__button" key={key} onClick={() => selectSegment(key)} type="button">{label}<span>{counts[key]}</span></button>)}</nav>
        {loading ? <div className="provider-activity-table provider-activity-table--loading" aria-label="Loading applications" role="status">{[0,1,2].map((item) => <Skeleton key={item} />)}</div>
          : error ? <section className="posts-feed__error" role="alert"><h2>Activity didn’t load</h2><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section>
            : (() => {
              const selectedItems = items.filter(predicates[segment])
              if (!selectedItems.length) return <section className="activity-empty provider-activity-empty"><EmptyState action={<Button as={Link} to="/app" variant="secondary">Browse open requests <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message="Open requests from customers will appear here." title={`No ${segment} applications`} /></section>
              return <div aria-label={`${segment} applications`} className="provider-activity-table">
                {selectedItems.map((item) => {
                  const post = item.post
                  const selected = item.status === 'hired' || post.hired_professional_id === user.id
                  const declined = !selected && (item.status === 'not_selected' || ['closed', 'removed'].includes(post.status))
                  const newActivity = item.activity && !item.activity.read_at
                  const statusLabel = selected ? post.status === 'completed' ? 'Completed' : 'In progress' : declined ? 'Declined' : 'Applied'
                  return <article className={`provider-activity-row${declined ? ' is-declined' : ''}`} key={item.id}>
                    <Link className="provider-activity-row__request" to={`/app/posts/${post.id}`}><span className="provider-activity-row__image">{post.coverPath ? <img alt="" src={getPostImageUrl(post.coverPath)} /> : <ClockCounterClockwise aria-hidden="true" size={20} />}</span><span><small>{post.service_categories?.name || 'Service request'}</small><strong>{post.title}</strong></span></Link>
                    <span className="provider-activity-row__customer">{item.customerName}</span>
                    <span className="provider-activity-row__budget"><strong>{formatPostBudget(post)}</strong>{item.message && <small>My quote: {item.message}</small>}</span>
                    <Badge tone={selected ? 'success' : declined ? 'neutral' : 'info'}>{statusLabel}</Badge>
                    <time>{formatRelativeTime(item.activity?.created_at || item.updated_at || item.created_at)}</time>
                    <div className="provider-activity-row__actions">{newActivity && <span aria-label="New update" className="provider-activity-row__new" />}{selected && FEATURES.chat && <Button as={Link} to={`/app/messages?postId=${post.id}`} variant="primary">Message</Button>}<Button as={Link} to={`/app/posts/${post.id}`} variant="secondary">View</Button></div>
                  </article>
                })}
              </div>
            })()}
      </section>
      <aside className="provider-activity-rail"><h2>Applications</h2><div className="provider-activity-rail__counts">{[['Applied', counts.applied], ['Selected', counts.selected], ['Declined', counts.declined]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div><div className="provider-activity-rail__ratio"><strong>{hiredCount} of {items.length}</strong><span>applications selected you</span></div></aside>
    </div> : loading ? <div className="activity-list" aria-label="Loading activity" role="status">{[0,1,2].map((item) => <Skeleton className="activity-skeleton" key={item} />)}</div>
      : error ? <section className="posts-feed__error" role="alert"><h2>Activity didn’t load</h2><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section>
        : items.length === 0 ? <section className="activity-empty"><EmptyState action={<Button as={Link} to="/app/discover" variant="secondary">Discover professionals <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message="When a professional applies or a customer makes a decision, updates will appear here." title="No activity yet" /></section>
          : <div className="activity-layout"><section aria-label="Recent activity" className="activity-list">{groups.map(([group, groupedItems]) => !groupedItems.length ? null : <div className="activity-group" key={group}><h2>{group}</h2><div className="activity-group__surface">{groupedItems.map((item) => {
            const target = item.kind === 'application_received' && item.problem_posts?.id ? `/app/posts/${item.post_id}/applicants` : `/app/posts/${item.post_id}`
            return <article className={`activity-item${item.read_at ? '' : ' is-unread'}`} key={item.id}><span className="activity-item__icon">{item.kind === 'application_received' ? <ClockCounterClockwise aria-hidden="true" size={19} /> : <CheckCircle aria-hidden="true" size={19} />}</span>{item.kind === 'application_received' && <Avatar name={item.actorName || 'Professional'} size={40} />}<div className="activity-item__body"><p>{activityMessage(item)}</p><time>{new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</time></div><div className="activity-item__actions">{FEATURES.chat && ['post_hired', 'post_completed'].includes(item.kind) && <Link aria-label="Message the hired professional" className="activity-message-action" to={`/app/messages?postId=${item.post_id}`}><span>Message</span></Link>}{!item.read_at && <button aria-label="Mark as read" className="activity-read-button" onClick={() => void markRead(item)} title="Mark as read" type="button"><span /></button>}<Link aria-label="Open related request" to={target}><ArrowRight aria-hidden="true" size={19} /></Link></div></article>
          })}</div></div>)}</section><MarketplaceRail userId={user.id} /></div>}
  </main>
}
