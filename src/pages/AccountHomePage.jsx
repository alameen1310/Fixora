import { ArrowRight } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { PostsFeed } from '../components/PostsFeed.jsx'
import MarketplaceRail from '../components/MarketplaceRail.jsx'
import ProviderHome from '../components/ProviderHome.jsx'
import CompletedWorkFeed from '../components/CompletedWorkFeed.jsx'
import { supabase } from '../lib/supabase.js'
import usePullToRefresh from '../hooks/usePullToRefresh.jsx'
import './AuthenticatedPages.css'

export default function AccountHomePage() {
  const { profile, user } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there'
  const [feedTab, setFeedTab] = useState('requests')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState([])
  const pullRefresh = usePullToRefresh(() => window.dispatchEvent(new CustomEvent('fixora:home-refresh')))

  useEffect(() => {
    if (isProvider) return undefined
    let active = true
    supabase.from('service_categories').select('name, slug').order('name').then(({ data }) => { if (active) setCategories(data ?? []) })
    return () => { active = false }
  }, [isProvider])

  if (isProvider) return <ProviderHome />

  return <div className="app-home-layout" ref={pullRefresh.containerRef}>
    {pullRefresh.indicator}
    <main className="app-page app-home app-home__main">
      <header className="customer-home__header"><h1>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {firstName}</h1></header>
      <nav aria-label="Filter requests by service" className="customer-home__services"><button aria-pressed={!selectedCategory} onClick={() => setSelectedCategory('')} type="button">All</button>{categories.map(({ name, slug }) => <button aria-pressed={selectedCategory === slug} key={slug} onClick={() => setSelectedCategory((current) => current === slug ? '' : slug)} type="button">{name}</button>)}</nav>
      <section aria-labelledby="home-posts-title" className="app-section">
        <div className="app-section__heading"><h2 id="home-posts-title">Posts</h2><Link className="app-text-link" to="/app/my-posts">My Posts <ArrowRight aria-hidden="true" size={16} /></Link></div>
        <div aria-label="Home feed" className="home-feed-tabs" role="group"><button aria-pressed={feedTab === 'requests'} onClick={() => setFeedTab('requests')} type="button">Requests</button><button aria-pressed={feedTab === 'completed'} onClick={() => setFeedTab('completed')} type="button">Before &amp; after</button></div>
        {feedTab === 'requests' ? <PostsFeed categorySlug={selectedCategory} showOwnLatest userId={user.id} /> : <CompletedWorkFeed />}
      </section>
    </main>
    <MarketplaceRail categories={categories} userId={user.id} />
  </div>
}
