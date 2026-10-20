import { ArrowRight } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { PostsFeed } from '../components/PostsFeed.jsx'
import MarketplaceRail from '../components/MarketplaceRail.jsx'
import ProviderHome from '../components/ProviderHome.jsx'
import CompletedWorkFeed from '../components/CompletedWorkFeed.jsx'
import './AuthenticatedPages.css'

export default function AccountHomePage() {
  const { profile, user } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there'
  const [feedTab, setFeedTab] = useState('requests')

  if (isProvider) return <ProviderHome />

  return <div className="app-home-layout">
    <main className="app-page app-home app-home__main">
      <header className="customer-home__header"><h1>Good to see you, {firstName}.</h1></header>
      <section aria-labelledby="home-posts-title" className="app-section">
        <div className="app-section__heading"><h2 id="home-posts-title">Posts</h2><Link className="app-text-link" to="/app/my-posts">My Posts <ArrowRight aria-hidden="true" size={16} /></Link></div>
        <div aria-label="Home feed" className="home-feed-tabs" role="group"><button aria-pressed={feedTab === 'requests'} onClick={() => setFeedTab('requests')} type="button">Requests</button><button aria-pressed={feedTab === 'completed'} onClick={() => setFeedTab('completed')} type="button">Before &amp; after</button></div>
        {feedTab === 'requests' ? <PostsFeed showOwnLatest userId={user.id} /> : <CompletedWorkFeed />}
      </section>
    </main>
    <MarketplaceRail userId={user.id} />
  </div>
}
