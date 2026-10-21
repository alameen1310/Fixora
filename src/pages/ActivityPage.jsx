import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, ClockCounterClockwise, Star } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Button, EmptyState, Skeleton } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import MarketplaceRail from '../components/MarketplaceRail.jsx'
import { fetchMarketplaceActivities, fetchProviderApplications, markMarketplaceActivityRead } from '../lib/applicationQueries.js'
import { formatPostBudget, formatRelativeTime, formatNaira } from '../lib/postQueries.js'
import { getPostImageUrl } from '../lib/postImages.js'
import { FEATURES } from '../config/features.js'
import './ActivityPage.css'
import './AuthenticatedPages.css'
import { avatarUrl } from '../lib/avatarImages.js'
import { appQueryCache } from '../lib/postListCache.js'
import { usePresence } from '../components/PresenceProvider.jsx'
import usePullToRefresh from '../hooks/usePullToRefresh.jsx'

const providerPredicates = (userId) => {
  const hired = (item) => item.status === 'hired' || item.post?.hired_professional_id === userId
  return {
    applied: (item) => item.status === 'pending' && item.post?.status === 'open',
    'in-progress': (item) => hired(item) && item.post?.status !== 'completed' && !item.post?.completed_at,
    completed: (item) => hired(item) && (item.post?.status === 'completed' || Boolean(item.post?.completed_at)),
    past: (item) => item.status === 'not_selected' || item.status === 'withdrawn' || (item.status === 'pending' && item.post?.status !== 'open'),
  }
}

const customerSegments = [
  { key: 'needs-action', label: 'New applications', description: 'Professionals who have applied to your open requests.' },
  { key: 'in-progress', label: 'In progress', description: 'Requests you have hired a professional to complete.' },
  { key: 'completed', label: 'Completed', description: 'Finished work and its follow-up details.' },
  { key: 'earlier', label: 'Past updates', description: 'Updates for requests that are no longer active.' },
]

const activityTime = (value) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

function CustomerActivityCard({ item, isOnline, onRead }) {
  const post = item.problem_posts
  const isApplication = item.kind === 'application_received'
  const isCompleted = item.kind === 'post_completed'
  const isHired = item.kind === 'post_hired'
  const target = isApplication && post?.id ? `/app/posts/${item.post_id}/applicants` : `/app/posts/${item.post_id}`
  const status = isApplication ? 'New application' : isHired ? 'In progress' : isCompleted ? 'Completed' : 'Update'
  const statusTone = isApplication ? 'info' : isHired ? 'success' : isCompleted ? 'deep' : 'neutral'
  const name = item.actorName || (isApplication || isHired || isCompleted ? 'Professional' : 'Fixora')
  const category = post?.service_categories?.name || 'Service request'
  const budget = post ? formatPostBudget(post) : ''
  const postTitle = post?.title || 'Your request'
  const profileLink = item.actor_id ? `/app/professionals/${item.actor_id}` : null

  return <article className={`activity-item${item.read_at ? '' : ' is-unread'}`}>
    <Link aria-label={`Open ${postTitle}`} className="activity-item__cover" onClick={() => void onRead(item)} to={`/app/posts/${item.post_id}`}>{post?.coverPath ? <img alt="" loading="lazy" src={getPostImageUrl(post.coverPath)} /> : <ClockCounterClockwise aria-hidden="true" size={24} />}</Link>
    <div className="activity-item__body">
      <div className="activity-item__topline">
        <div className="activity-item__request-title"><span>{category}</span><Link onClick={() => void onRead(item)} to={`/app/posts/${item.post_id}`}>{postTitle}</Link></div>
        <Badge tone={statusTone}>{status}</Badge>
      </div>
      <div className="activity-item__identity-row"><Avatar className="activity-item__avatar" name={name} size={34} src={avatarUrl(item.actorAvatarPath)} presence={item.actor_id ? isOnline(item.actor_id) : false} /><div className="activity-item__identity"><strong>{name}</strong>
          {Number(item.actorRating?.review_count) > 0 && <span className="activity-item__reputation"><Star aria-hidden="true" size={14} weight="fill" />{Number(item.actorRating.average_rating).toFixed(1)} ({item.actorRating.review_count}){item.actorCompletedJobs > 0 && <span> · {item.actorCompletedJobs} {item.actorCompletedJobs === 1 ? 'job' : 'jobs'} completed</span>}</span>}
        </div><time dateTime={item.created_at} title={activityTime(item.created_at)}>{formatRelativeTime(item.created_at)}</time><span className="activity-item__unread-wrap">{!item.read_at && <span aria-label="Unread activity" className="activity-item__unread-dot" />}</span>
      </div>
      <strong className="activity-item__budget">{isCompleted && post?.final_price_naira ? `Paid ${formatNaira(post.final_price_naira)}` : budget}</strong>
      <div className="activity-item__details">{post?.city || post?.region ? <span className="activity-item__location">{[post.city, post.region].filter(Boolean).join(', ')}</span> : null}</div>
      {item.problem_post_applications?.message && <blockquote className="activity-item__note">{item.problem_post_applications.message}</blockquote>}
      {isCompleted && <div className="activity-item__completion-meta">{item.review?.rating && <span aria-label={`${item.review.rating} out of 5 stars`}><Star aria-hidden="true" size={15} weight="fill" />{item.review.rating} stars given</span>}{post?.final_price_naira > 0 && <strong>Paid {formatNaira(post.final_price_naira)}</strong>}</div>}
      <div className="activity-item__actions" onClick={(event) => event.stopPropagation()}>
        {isApplication && <><Button as={Link} to={target} onClick={() => void onRead(item)}>Review applicants</Button>{profileLink && <Button as={Link} to={profileLink} variant="secondary">View profile</Button>}</>}
        {isHired && <>{FEATURES.chat && <Button as={Link} to={`/app/messages?postId=${item.post_id}`} variant="secondary">Message</Button>}<Button as={Link} to={`/app/posts/${item.post_id}/complete`}>Mark as completed</Button></>}
        {isCompleted && <Button as={Link} to={`/app/posts/${item.post_id}`} variant="secondary">View before &amp; after</Button>}
        {!isApplication && !isHired && !isCompleted && <Button as={Link} to={target} variant="secondary">View request</Button>}
      </div>
    </div>
  </article>
}

export default function ActivityPage() {
  const { user, profile } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const { isOnline, refreshPresence } = usePresence()
  const [searchParams, setSearchParams] = useSearchParams()
  const cacheKey = `${user.id}:activity:${isProvider ? 'provider' : 'customer'}`
  const cached = appQueryCache.get(cacheKey)
  const [items, setItems] = useState(() => cached?.items ?? [])
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState(false)
  const lastRefreshAt = useRef(cached?.lastRefreshAt || 0)
  const loadInFlight = useRef(false)
  const [segment, setSegment] = useState(() => {
    const requested = searchParams.get('segment')
    if (isProvider && requested === 'declined') return 'past'
    const validSegments = isProvider ? ['applied', 'in-progress', 'completed', 'past'] : ['needs-action', 'in-progress', 'completed', 'earlier']
    return validSegments.includes(requested) ? requested : isProvider ? 'applied' : 'needs-action'
  })

  const load = useCallback(async ({ silent = false } = {}) => {
    if (loadInFlight.current) return
    loadInFlight.current = true
    if (!silent) { setLoading(true); setError(false) }
    const startedAt = performance.now()
    try {
      const nextItems = isProvider ? await fetchProviderApplications(user.id) : await fetchMarketplaceActivities(user.id)
      setItems(nextItems)
      lastRefreshAt.current = Date.now()
      appQueryCache.set(cacheKey, { items: nextItems, lastRefreshAt: lastRefreshAt.current })
      setError(false)
      if (import.meta.env.DEV) console.info('[query-timing] Activity', { role: isProvider ? 'provider' : 'customer', durationMs: Math.round(performance.now() - startedAt), rows: nextItems.length })
    } catch (loadError) {
      console.error('[activity-load]', { code: loadError?.code, message: loadError?.message })
      setError(true)
    } finally { loadInFlight.current = false; setLoading(false) }
  }, [cacheKey, isProvider, user.id])
  const pullRefresh = usePullToRefresh(() => load({ silent: true }))

  useEffect(() => { if (!cached) void load(); else if (Date.now() - lastRefreshAt.current >= 60_000) void load({ silent: true }) }, [cacheKey, cached, load])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && Date.now() - lastRefreshAt.current >= 60_000) void load({ silent: true }) }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [load])
  useEffect(() => { void refreshPresence(items.map((item) => isProvider ? item.post?.author_id : item.actor_id).filter(Boolean)) }, [items, isProvider, refreshPresence])

  const markRead = useCallback(async (item) => {
    if (!item.read_at) {
      try {
        await markMarketplaceActivityRead(item.id, user.id)
        setItems((current) => {
          const next = current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)
          appQueryCache.set(cacheKey, { items: next, lastRefreshAt: lastRefreshAt.current })
          return next
        })
      } catch (readError) { console.error('[activity-read]', { id: item.id, code: readError?.code, message: readError?.message }) }
    }
  }, [cacheKey, user.id])
  function selectSegment(next) { setSegment(next); const params = new URLSearchParams(searchParams); params.set('segment', next); setSearchParams(params, { replace: true }) }

  const providerFilters = providerPredicates(user.id)
  const providerCounts = Object.fromEntries(Object.entries(providerFilters).map(([key, predicate]) => [key, items.filter(predicate).length]))
  const attention = (item) => item.kind === 'application_received' && item.problem_posts?.status === 'open'
  const inProgress = (item) => item.kind === 'post_hired'
  const completed = (item) => item.kind === 'post_completed'
  const belongsToCustomerSegment = {
    'needs-action': attention,
    'in-progress': inProgress,
    completed,
    earlier: (item) => !attention(item) && !inProgress(item) && !completed(item),
  }
  const customerCounts = Object.fromEntries(customerSegments.map(({ key }) => [key, items.filter(belongsToCustomerSegment[key]).length]))
  const displayedCustomerItems = items.filter(belongsToCustomerSegment[segment] || belongsToCustomerSegment['needs-action'])
  const selectedCustomerSegment = customerSegments.find(({ key }) => key === segment) || customerSegments[0]
  const unreadCount = items.filter((item) => !item.read_at).length
  const hiredCount = items.filter((item) => item.status === 'hired').length

  return <main className="app-page app-page--activity" ref={pullRefresh.containerRef}>
    {pullRefresh.indicator}
    <header className="app-page__heading activity-heading"><h1 className="text-large-title">Activity</h1><Badge tone="neutral">{items.length} updates</Badge></header>
    {isProvider ? <div className="provider-activity-layout">
      <section className="provider-activity-main">
        <nav aria-label="Application status" className="provider-activity-tabs">{[['applied', 'Applied'], ['in-progress', 'In progress'], ['completed', 'Completed'], ['past', 'Past applications']].map(([key, label]) => <button aria-pressed={segment === key} className="provider-activity-tabs__button" key={key} onClick={() => selectSegment(key)} type="button">{label}<span>{providerCounts[key]}</span></button>)}</nav>
        {loading ? <div className="provider-activity-list" aria-label="Loading applications" role="status">{[0,1,2].map((item) => <Skeleton className="provider-application-card" key={item} />)}</div>
          : error ? <section className="posts-feed__error" role="alert"><h2>Activity didn’t load</h2><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section>
            : (() => {
              const selectedItems = items.filter(providerFilters[segment] || providerFilters.applied)
              if (!selectedItems.length) return <section className="activity-empty provider-activity-empty"><EmptyState action={<Button as={Link} to="/app" variant="secondary">Browse open requests <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message={segment === 'applied' ? 'Applications you send will appear here.' : 'There are no requests in this category yet.'} title={segment === 'past' ? 'No past applications' : `No ${segment.replace('-', ' ')} applications`} /></section>
              return <div aria-label={`${segment} applications`} className="provider-activity-list">
                {selectedItems.map((item) => {
                  const post = item.post
                  const selected = item.status === 'hired' || post.hired_professional_id === user.id
                  const isCompleted = selected && (post.status === 'completed' || Boolean(post.completed_at))
                  const declined = !selected && (item.status === 'not_selected' || item.status === 'withdrawn' || (item.status === 'pending' && post.status !== 'open'))
                  const statusLabel = isCompleted ? 'Completed' : selected ? 'In progress' : declined ? 'Past application' : 'Applied'
                  const unread = item.activity && !item.activity.read_at
                  return <article className={`provider-application-card${declined ? ' is-declined' : ''}`} key={item.id}>
                    <Link aria-label={`View request: ${post.title}`} className="provider-application-card__cover" to={`/app/posts/${post.id}`}>{post.coverPath ? <img alt="" loading="lazy" src={getPostImageUrl(post.coverPath)} /> : <ClockCounterClockwise aria-hidden="true" size={24} />}</Link>
                    <div className="provider-application-card__main">
                      <div className="provider-application-card__top"><div><span className="provider-application-card__category">{post.service_categories?.name || 'Service request'}</span><Link to={`/app/posts/${post.id}`}>{post.title}</Link></div><Badge tone={selected ? 'success' : declined ? 'neutral' : 'info'}>{statusLabel}</Badge></div>
                      <strong className="provider-application-card__budget">{formatPostBudget(post)}</strong>
                      <div className="provider-application-card__meta">{(post.city || post.region) && <span>{[post.city, post.region].filter(Boolean).join(', ')}</span>}</div>
                      <div className="provider-application-card__identity"><Avatar name={item.customerName} size={34} src={avatarUrl(item.customerAvatarPath)} /><span>{item.customerName}</span><time title={activityTime(item.activity?.created_at || item.updated_at || item.created_at)}>{formatRelativeTime(item.activity?.created_at || item.updated_at || item.created_at)}</time>{unread && <span aria-label="New activity" className="provider-application-card__new" />}</div>
                      {item.message && <blockquote className="provider-application-card__note">{item.message}</blockquote>}
                      <div className="provider-application-card__foot"><span className="provider-application-card__actions">{selected && !isCompleted && FEATURES.chat && <Button as={Link} to={`/app/messages?postId=${post.id}`} variant="secondary">Message</Button>}<Button as={Link} to={`/app/posts/${post.id}`} variant="secondary">View request</Button></span></div>
                    </div>
                  </article>
                })}
              </div>
            })()}
      </section>
      <aside className="provider-activity-rail"><h2>Applications</h2><div className="provider-activity-rail__counts">{[['Applied', providerCounts.applied], ['In progress', providerCounts['in-progress']], ['Completed', providerCounts.completed], ['Past applications', providerCounts.past]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div><div className="provider-activity-rail__ratio"><strong>{hiredCount} of {items.length}</strong><span>applications selected you</span></div></aside>
    </div> : <>
      <nav aria-label="Activity categories" className="customer-activity-tabs">{customerSegments.map(({ key, label }) => <button aria-pressed={segment === key} key={key} onClick={() => selectSegment(key)} type="button">{label}<span>{customerCounts[key]}</span></button>)}</nav>
      {loading ? <div className="activity-layout"><section className="activity-list" aria-label="Loading activity" role="status">{[0,1,2].map((item) => <Skeleton className="activity-skeleton" key={item} />)}</section></div>
        : error ? <section className="posts-feed__error" role="alert"><h2>Activity didn’t load</h2><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section>
          : items.length === 0 ? <section className="activity-empty"><EmptyState action={<Button as={Link} to="/app/discover" variant="secondary">Browse professionals <ArrowRight aria-hidden="true" size={16} /></Button>} icon={Bell} message="When a professional applies or a customer makes a decision, updates will appear here." title="No activity yet" /></section>
            : <div className="activity-layout"><section aria-label={`${selectedCustomerSegment.label} activity`} className="activity-list">
              <header className="activity-section-heading"><div><h2>{selectedCustomerSegment.label}</h2><p>{selectedCustomerSegment.description}</p></div><span>{displayedCustomerItems.length} {displayedCustomerItems.length === 1 ? 'update' : 'updates'}</span></header>
              {displayedCustomerItems.length ? displayedCustomerItems.map((item) => <CustomerActivityCard isOnline={isOnline} item={item} key={item.id} onRead={markRead} />) : <ActivitySegmentEmpty segment={segment} />}
            </section><aside className="customer-activity-rail"><div className="customer-activity-summary"><h2>Activity summary</h2><div><span>Needs attention</span><strong>{customerCounts['needs-action']}</strong></div><div><span>In progress</span><strong>{customerCounts['in-progress']}</strong></div><div><span>Completed</span><strong>{customerCounts.completed}</strong></div></div><MarketplaceRail showServices={false} userId={user.id} /></aside></div>}
      {unreadCount > 0 && <span className="sr-only" aria-live="polite">{unreadCount} unread updates</span>}
    </>}
  </main>
}

function ActivitySegmentEmpty({ segment }) {
  const messages = {
    'needs-action': ['No new applications', 'When a professional applies to an open request, it will appear here.'],
    'in-progress': ['No work in progress', 'When you hire a professional, the request will appear here.'],
    completed: ['No completed work yet', 'Completed requests and their before-and-after photos will appear here.'],
    earlier: ['No past updates', 'Updates for closed or inactive requests will appear here.'],
  }
  const [title, message] = messages[segment] || messages['needs-action']
  return <section className="activity-segment-empty"><h2>{title}</h2><p>{message}</p><Link to="/app/my-posts">View your posts <ArrowRight aria-hidden="true" size={16} /></Link></section>
}
