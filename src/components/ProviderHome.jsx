import { useEffect, useState } from 'react'
import { ArrowRight, Briefcase, Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Avatar, Badge, Button, EmptyState, Skeleton } from './UiPrimitives.jsx'
import PostThumb from './PostThumb.jsx'
import { fetchProviderApplications } from '../lib/applicationQueries.js'
import { formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'
import { avatarUrl } from '../lib/avatarImages.js'
import { appQueryCache } from '../lib/postListCache.js'
import './ProviderHome.css'
import usePullToRefresh from '../hooks/usePullToRefresh.jsx'
import ProfileCompleteness from './ProfileCompleteness.jsx'

const columns = 'id, author_id, title, description, category_id, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, schedule_mode, status, hired_professional_id, created_at, completed_at, final_price_naira, service_categories(name, slug), problem_post_images(storage_path, sort_order, kind)'

function normalize(value) { return String(value || '').trim().toLowerCase().replace(/\s+state$/, '') }
function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}
function Naira({ value }) { return value ? `₦${Number(value).toLocaleString('en-NG')}` : '–' }

export default function ProviderHome() {
  const { profile, user } = useAuth()
  const name = profile?.full_name?.trim().split(/\s+/)[0] || 'there'
  const cacheKey = `${user.id}:provider-home`
  const cached = appQueryCache.get(cacheKey)
  const [data, setData] = useState(() => cached?.data ?? null)
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [newRequest, setNewRequest] = useState(false)
  const pullRefresh = usePullToRefresh(() => setRetry((value) => value + 1))
  useEffect(() => {
    const onNewRequest = () => setNewRequest(true)
    const refreshRequests = () => { setNewRequest(false); setRetry((value) => value + 1) }
    window.addEventListener('fixora:new-request', onNewRequest)
    window.addEventListener('fixora:discover-refresh', refreshRequests)
    return () => { window.removeEventListener('fixora:new-request', onNewRequest); window.removeEventListener('fixora:discover-refresh', refreshRequests) }
  }, [])

  useEffect(() => {
    let active = true
    async function load(silent = false) {
      if (!silent) setLoading(true)
      setError(false)
      const startedAt = performance.now()
      try {
        const [providerResult, pendingResult, activeResult, completedResult, ratingResult, applications] = await Promise.all([
          supabase.from('provider_profiles').select('profile_id, display_name, service_description, is_published, avatar_path, availability, is_nationwide, provider_service_categories(category_id, category:service_categories(name, slug)), provider_service_areas(country_code, region, city, state_code)').eq('profile_id', user.id).maybeSingle(),
          supabase.from('problem_post_applications').select('id, problem_posts!inner(status)', { count: 'exact', head: true }).eq('professional_id', user.id).eq('status', 'pending').eq('problem_posts.status', 'open'),
          supabase.from('problem_posts').select(columns, { count: 'exact' }).eq('hired_professional_id', user.id).eq('status', 'closed').order('hired_at', { ascending: false }).limit(8),
          supabase.from('problem_posts').select('id, final_price_naira, completed_at', { count: 'exact' }).eq('hired_professional_id', user.id).eq('status', 'completed'),
          supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').eq('provider_id', user.id).maybeSingle(),
          fetchProviderApplications(user.id),
        ])
        for (const result of [providerResult, pendingResult, activeResult, completedResult, ratingResult]) if (result.error) throw result.error
        const provider = providerResult.data
        const categories = provider?.provider_service_categories ?? []
        const areas = provider?.provider_service_areas ?? []
        let matched = []
        if (categories.length && (areas.length || provider?.is_nationwide)) {
          const { data: openPosts, error: openError } = await supabase.from('problem_posts').select(columns).eq('status', 'open').not('published_at', 'is', null).neq('author_id', user.id).in('category_id', categories.map(({ category_id }) => category_id)).order('created_at', { ascending: false }).limit(60)
          if (openError) throw openError
          const regions = new Set(areas.filter((area) => area.country_code === 'NG').map(({ region }) => normalize(region)))
          matched = (openPosts ?? []).filter((post) => provider?.is_nationwide || regions.has(normalize(post.region))).slice(0, 4)
        }
        const appByPost = new Map(applications.map((application) => [application.post_id, application]))
        const activeJobs = (activeResult.data ?? []).map((post) => ({ ...post, application: appByPost.get(post.id) }))
        const postIds = [...new Set([...activeJobs.map(({ id }) => id), ...matched.map(({ id }) => id)])]
        let authorNames = {}; let authorAvatars = {}
        if (postIds.length) {
          const { data: rows, error: namesError } = await supabase.rpc('get_problem_post_author_cards', { requested_post_ids: postIds })
          if (namesError) throw namesError
          authorNames = Object.fromEntries((rows ?? []).map(({ post_id, display_name }) => [post_id, display_name]))
          const authorIds = [...new Set((rows ?? []).map(({ author_id }) => author_id).filter(Boolean))]
          if (authorIds.length) {
            const { data: photos, error: photosError } = await supabase.rpc('get_profile_photo_cards', { requested_profile_ids: authorIds })
            if (photosError) throw photosError
            const avatarByAuthor = Object.fromEntries((photos ?? []).map(({ profile_id, avatar_path }) => [profile_id, avatar_path]))
            authorAvatars = Object.fromEntries((rows ?? []).map(({ post_id, author_id }) => [post_id, avatarByAuthor[author_id] || null]))
          }
        }
        const applicationActivity = applications.filter((application) => application.status !== 'withdrawn').map((application) => ({
          id: application.id, created_at: application.updated_at || application.created_at,
          text: application.status === 'hired' ? `Selected for ${application.post?.title || 'a request'}` : application.status === 'not_selected' ? `Not selected for ${application.post?.title || 'a request'}` : `Applied to ${application.post?.title || 'a request'}`,
        }))
        const { data: reviews, error: reviewError } = await supabase.from('job_reviews').select('id, rating, comment, customer_display_name, created_at, problem_posts(title)').eq('provider_id', user.id).order('created_at', { ascending: false }).limit(6)
        if (reviewError) throw reviewError
        const reviewActivity = (reviews ?? []).map((review) => ({ id: `review-${review.id}`, created_at: review.created_at, text: `Received a ${review.rating}-star review` }))
        if (!active) return
        const earned = (completedResult.data ?? []).reduce((sum, post) => sum + Number(post.final_price_naira || 0), 0)
        const nextData = { provider, matched, applications, activeJobs, activeCount: activeResult.count ?? 0, authorNames, authorAvatars, pendingCount: pendingResult.count ?? 0, completedCount: completedResult.count ?? 0, earned, rating: ratingResult.data, latestReview: reviews?.[0] ?? null, activity: [...applicationActivity, ...reviewActivity].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5) }
        setData(nextData)
        appQueryCache.set(cacheKey, { data: nextData, lastRefreshAt: Date.now() })
        if (import.meta.env.DEV) console.info('[query-timing] Provider home', { durationMs: Math.round(performance.now() - startedAt), rows: matched.length + activeJobs.length })
      } catch (loadError) {
        console.error('[provider-home]', { code: loadError?.code, message: loadError?.message })
        if (active) setError(true)
      } finally { if (active) setLoading(false) }
    }
    const isFresh = cached && Date.now() - cached.lastRefreshAt < 60_000
    if (!isFresh) void load(Boolean(cached))
    else setLoading(false)
    const refresh = () => {
      const latest = appQueryCache.get(cacheKey)
      if (document.visibilityState === 'visible' && Date.now() - (latest?.lastRefreshAt ?? 0) >= 60_000) void load(true)
    }
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; document.removeEventListener('visibilitychange', refresh) }
  }, [cacheKey, cached?.lastRefreshAt, user.id, retry])

  const provider = data?.provider
  const services = (provider?.provider_service_categories ?? []).map(({ category }) => category?.name).filter(Boolean)
  const profileReady = Boolean(provider?.is_published && provider.provider_service_categories?.length && (provider.is_nationwide || provider.provider_service_areas?.length))
  const hasRailContent = Boolean(data?.activity.length || data?.latestReview || provider?.is_published || !provider)
  const setupMessage = !provider ? 'Create your professional profile to appear in public search.' : !provider.provider_service_categories?.length ? 'Add the services you offer so requests can match your profile.' : !provider.is_nationwide && !provider.provider_service_areas?.length ? 'Add the states where you work to match nearby requests.' : 'Publish your profile to appear in public search.'

  if (loading) return <main className="provider-home app-page"><header className="provider-home__header"><Skeleton style={{ width: 280, height: 38 }} /></header><div className="provider-home__stats"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div><Skeleton style={{ height: 300 }} /></main>
  if (error) return <main className="provider-home app-page"><header className="provider-home__header"><h1>Home</h1></header><section className="provider-home__error" role="alert"><p>Your dashboard couldn’t load.</p><Button onClick={() => setRetry((value) => value + 1)} variant="secondary">Try again</Button></section></main>

  const ratingCount = Number(data?.rating?.review_count || 0)
  const stats = [
    { label: 'Active jobs', value: data?.activeCount || 0, to: '/app/activity?segment=selected', hint: 'In progress' },
    { label: 'Pending applications', value: data?.pendingCount || 0, to: '/app/activity?segment=applied', hint: 'Awaiting a response' },
    { label: 'Completed jobs', value: data?.completedCount || 0, to: `/app/professionals/${user.id}#completed-work`, hint: data?.earned > 0 ? `${Naira({ value: data.earned })} earned` : 'No earnings yet' },
    { label: 'Rating', value: ratingCount ? <><Star aria-hidden="true" size={18} weight="fill" /> {Number(data.rating.average_rating).toFixed(1)}</> : '–', to: `/app/professionals/${user.id}#reviews`, hint: ratingCount ? `${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet' },
  ]

  return <div className={`provider-home-layout${hasRailContent ? ' has-rail' : ''}`} ref={pullRefresh.containerRef}>
    {pullRefresh.indicator}
    <main className="provider-home app-page">
      <header className="provider-home__header"><div><h1>{greeting()}, {name}</h1></div><div className="provider-home__header-actions">{newRequest && <button className="provider-home__new-request" onClick={() => window.dispatchEvent(new CustomEvent('fixora:discover-refresh'))} type="button">New request <ArrowRight size={15} /></button>}<Link className={`provider-home__live${profileReady ? '' : ' is-draft'}`} to={profileReady ? `/app/professionals/${user.id}` : '/onboarding/provider'}><span />{profileReady ? 'Profile live' : 'Complete profile'}<ArrowRight aria-hidden="true" size={15} /></Link></div></header>
      {!profileReady && <aside className="provider-home__setup"><div><strong>Your profile needs one more step</strong><span>{setupMessage}</span></div><Button as={Link} to="/onboarding/provider" variant="secondary">Finish profile</Button></aside>}
      <section aria-label="Your work summary" className="provider-home__stats">{stats.map((stat) => <Link className="provider-stat" key={stat.label} to={stat.to}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.hint}</small></Link>)}</section>
      <section className="provider-home__section"><div className="provider-home__section-head"><div><h2>Matched to your services</h2><p>Open requests that fit the work you offer.</p></div><Link to="/app/discover">See all <ArrowRight aria-hidden="true" size={15} /></Link></div>
        {data?.matched.length ? <div className="provider-home__matched-grid">{data.matched.map((post) => {
          const cover = post.problem_post_images?.filter((image) => image.kind === 'before').sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path
          const application = data.applications.find((row) => row.post_id === post.id)
          return <Link className="provider-home__matched-row" key={post.id} to={`/app/posts/${post.id}`}><span className="provider-home__matched-thumb"><PostThumb category={post.service_categories} path={cover} /></span><span className="provider-home__matched-copy"><span className="provider-home__matched-title"><strong>{post.title}</strong><Badge tone="info">{post.service_categories?.name || 'Service'}</Badge>{application && <Badge tone="success">Applied</Badge>}</span><strong>{formatPostBudget(post)}</strong><span className="provider-home__matched-meta">{[post.city, post.region].filter(Boolean).join(', ') || 'Location not specified'} · {formatRelativeTime(post.created_at)}</span></span><ArrowRight aria-hidden="true" size={18} /></Link>
        })}</div> : <EmptyState action={<Button as={Link} to="/app/discover" variant="secondary">Find work</Button>} icon={Briefcase} message="New requests appear here as customers post them." title="No open requests yet" />}
      </section>
      {data?.activeJobs.length > 0 && <section className="provider-home__section"><div className="provider-home__section-head"><h2>Active jobs</h2><Link to="/app/activity?segment=selected">View all <ArrowRight aria-hidden="true" size={15} /></Link></div><div className="provider-job-list">{data.activeJobs.map((post) => <article className="provider-job-row" key={post.id}><Avatar name={data.authorNames[post.id] || 'Customer'} size={42} src={avatarUrl(data.authorAvatars?.[post.id])} /><div className="provider-job-row__copy"><strong>{data.authorNames[post.id] || 'Customer'}</strong><Link to={`/app/posts/${post.id}`}>{post.title}</Link></div><Badge tone="success">In progress</Badge><Button as={Link} to={`/app/messages?postId=${post.id}`} variant="secondary">Message</Button><Button as={Link} to={`/app/posts/${post.id}`} variant="ghost">View</Button></article>)}</div></section>}
    </main>
    {hasRailContent && <aside className="provider-home__rail">
      {provider && <ProfileCompleteness profile={profile} provider={provider} userId={user.id} />}
      {data?.activity.length > 0 && <section className="provider-rail-block"><h2>Recent activity</h2>{data.activity.map((item) => <div className="provider-activity-line" key={item.id}><span>{item.text}</span><time>{formatRelativeTime(item.created_at)}</time></div>)}</section>}
      {data?.latestReview && <section className="provider-rail-block provider-latest-review"><h2>Latest review</h2><div className="provider-latest-review__stars"><Star aria-hidden="true" size={15} weight="fill" /> {data.latestReview.rating}/5</div>{data.latestReview.comment && <p>{data.latestReview.comment}</p>}<span>{data.latestReview.customer_display_name}</span></section>}
      {provider?.is_published && <section className="provider-public-mini"><span className="provider-public-mini__label">Your public profile</span><div><Avatar name={provider.display_name} size={44} src={avatarUrl(provider.avatar_path)} /><div><strong>{provider.display_name}</strong><span>{services.slice(0, 2).join(' · ') || 'Services not listed'}</span></div></div><Link to={`/app/professionals/${user.id}`}>View as customer <ArrowRight aria-hidden="true" size={15} /></Link></section>}
      {!provider && <section className="provider-rail-block"><h2>Get started</h2><p>Set up your professional profile to find requests that match your services.</p><Button as={Link} to="/onboarding/provider" variant="primary"><Briefcase aria-hidden="true" size={16} />Complete profile</Button></section>}
    </aside>}
  </div>
}
