import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Card, Skeleton } from '../components/UiPrimitives.jsx'
import { PostsFeed } from '../components/PostsFeed.jsx'
import MarketplaceDoodle from '../components/MarketplaceDoodle.jsx'
import { supabase } from '../lib/supabase.js'
import MarketplaceRail from '../components/MarketplaceRail.jsx'
import CompletedWorkFeed from '../components/CompletedWorkFeed.jsx'
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
  const [feedTab, setFeedTab] = useState('requests')

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
        <div aria-label="Home feed" className="home-feed-tabs" role="group">
          <button aria-pressed={feedTab === 'requests'} onClick={() => setFeedTab('requests')} type="button">Requests</button>
          <button aria-pressed={feedTab === 'completed'} onClick={() => setFeedTab('completed')} type="button">Before & after</button>
        </div>
        {feedTab === 'requests' ? <PostsFeed showOwnLatest={!isProvider} userId={user.id} /> : <CompletedWorkFeed />}
      </section>
    </main>
    {!isProvider && <MarketplaceRail userId={user.id} />}
    </div>
  )
}
