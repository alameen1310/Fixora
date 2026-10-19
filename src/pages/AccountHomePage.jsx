import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle, Plus, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Card, Skeleton } from '../components/UiPrimitives.jsx'
import { PostsFeed } from '../components/PostsFeed.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchLatestMyPosts } from '../lib/postQueries.js'
import './AuthenticatedPages.css'

export default function AccountHomePage() {
  const { profile, user } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there'
  const [animateEntrance] = useState(() => {
    try {
      if (window.sessionStorage.getItem('fixora.homeEntranceSeen')) return false
      window.sessionStorage.setItem('fixora.homeEntranceSeen', '1')
      return true
    } catch { return true }
  })
  const [providerProfile, setProviderProfile] = useState(null)
  const [providerLoading, setProviderLoading] = useState(isProvider)
  const [railPosts, setRailPosts] = useState([])
  const [railError, setRailError] = useState(false)
  const [railLoading, setRailLoading] = useState(!isProvider)

  useEffect(() => {
    if (!isProvider || !user?.id) {
      setProviderLoading(false)
      return undefined
    }
    let active = true
    setProviderLoading(true)
    supabase?.from('provider_profiles')
      .select('profile_id, display_name, provider_type, is_published')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setProviderProfile(data)
          setProviderLoading(false)
        }
      })
      .catch(() => { if (active) setProviderLoading(false) })
    return () => { active = false }
  }, [isProvider, user?.id])

  useEffect(() => {
    if (isProvider || !user?.id) return undefined
    let active = true
    setRailLoading(true)
    fetchLatestMyPosts(user.id, 3)
      .then((posts) => { if (active) { setRailPosts(posts); setRailError(false) } })
      .catch(() => { if (active) setRailError(true) })
      .finally(() => { if (active) setRailLoading(false) })
    return () => { active = false }
  }, [isProvider, user?.id])

  const isPublished = Boolean(providerProfile?.is_published)
  const isOnboardingComplete = Boolean(profile?.onboarding_completed_at)

  return (
    <div className="app-home-layout">
    <main className={`app-page app-home app-home__main${animateEntrance ? ' app-home--enter' : ''}`}>
      <header className="home-hero">
        <MarketplaceDoodle className="home-hero__doodle" />
        <div className="home-hero__copy">
          <h1 className="text-large-title">Good to see you, {firstName}.</h1>
          <p className="home-hero__subtitle">{isProvider ? 'Your Fixora home.' : 'Local help starts with a clear request.'}</p>
        </div>
        {!isProvider ? <div className="home-hero__actions">
          <Link className="home-hero__post-link" to="/app/posts/new"><Plus aria-hidden="true" size={18} weight="bold" />Post a problem</Link>
          <Link className="home-my-posts-link" to="/app/my-posts">My Posts <ArrowRight aria-hidden="true" size={16} /></Link>
        </div> : <Link className="home-hero__provider-link" to="/app/discover">Explore Fixora <ArrowRight aria-hidden="true" size={16} /></Link>}
      </header>

      {isProvider && (
        <section aria-labelledby="provider-status-title" className="app-section">
          <div className="app-section__heading"><h2 id="provider-status-title">Profile status</h2></div>
          {providerLoading ? (
            <Card><Skeleton style={{ height: '4rem' }} /></Card>
          ) : (
            <Card className="home-status-card">
              <div className="home-status-card__header">
                <span className={`home-status-icon ${isPublished ? 'is-published' : 'is-draft'}`}>
                  {isPublished ? <CheckCircle size={28} weight="fill" /> : <WarningCircle size={28} weight="fill" />}
                </span>
                <div>
                  <h3>{isPublished ? 'Profile is published' : 'Profile in progress'}</h3>
                  <p>{isPublished ? 'Customers can discover your profile, services, and areas.' : 'Complete your profile setup to appear in public searches.'}</p>
                </div>
              </div>
              {!isOnboardingComplete && <Link className="home-status-link" to="/onboarding/provider">Finish your profile</Link>}
            </Card>
          )}
        </section>
      )}

      <section aria-labelledby="home-posts-title" className="app-section">
        <div className="app-section__heading">
          <h2 id="home-posts-title">{isProvider ? 'Open posts' : 'Posts'}</h2>
          {isProvider ? (
            <span className="home-read-only-label">Read only</span>
          ) : (
            <Link className="app-text-link" to="/app/my-posts">My Posts <ArrowRight aria-hidden="true" size={16} /></Link>
          )}
        </div>
        <PostsFeed showOwnLatest={!isProvider} userId={user.id} />
      </section>
    </main>
    <aside aria-label="More from Fixora" className="app-home__rail">
      {!isProvider && (
        <section aria-labelledby="home-your-posts-title" className="home-rail-card">
          <div className="app-section__heading"><h2 id="home-your-posts-title">Your posts</h2><Link aria-label="View all your posts" to="/app/my-posts">All</Link></div>
          {railLoading ? <p className="home-rail-empty">Loading your posts…</p> : railError ? <button className="home-rail-retry" onClick={() => { setRailError(false); setRailLoading(true); fetchLatestMyPosts(user.id, 3).then(setRailPosts).catch(() => setRailError(true)).finally(() => setRailLoading(false)) }} type="button">Couldn’t load posts · Retry</button> : railPosts.length ? railPosts.map((post) => (
            <Link className="home-rail-post" key={post.id} to={`/app/posts/${post.id}`}>
              <span>{post.title}</span><small>{post.status === 'closed' ? 'Closed' : 'Open'}</small>
            </Link>
          )) : <p className="home-rail-empty">Your published posts will appear here.</p>}
        </section>
      )}
      {isProvider && <section className="home-rail-card home-rail-card--provider">
        <div className="app-section__heading"><h2>Professional profile</h2><span className={`home-rail-status${isPublished ? ' is-published' : ''}`}>{providerLoading ? 'Checking' : isPublished ? 'Published' : 'In progress'}</span></div>
        <p>{providerLoading ? 'Loading your profile status.' : isPublished ? 'Customers can find your services and service areas.' : 'Finish your profile to appear in professional searches.'}</p>
        <Link to={isOnboardingComplete ? '/app/profile' : '/onboarding/provider'}>{isOnboardingComplete ? 'View profile' : 'Continue setup'} <ArrowRight aria-hidden="true" size={16} /></Link>
      </section>}
      <Link className="home-rail-discover" to="/app/discover"><strong>{isProvider ? 'Browse customer requests' : 'Find professionals'}</strong><span>{isProvider ? 'Explore open household requests.' : 'Browse local services and profiles.'}</span><ArrowRight aria-hidden="true" size={18} /></Link>
    </aside>
    </div>
  )
}
