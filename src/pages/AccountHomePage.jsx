import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, CheckCircle, Drop, Hammer, Lightning, MagnifyingGlass, PaintBrush, WarningCircle, Wrench } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import PublishedProfessionals from '../components/PublishedProfessionals.jsx'
import { Button, Card, Skeleton } from '../components/UiPrimitives.jsx'
import { supabase } from '../lib/supabase.js'
import './AuthenticatedPages.css'

const categoryIcons = {
  repairs: Wrench,
  plumbing: Drop,
  installations: Hammer,
  electrical: Lightning,
  maintenance: Wrench,
  renovation: PaintBrush,
}

export default function AccountHomePage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const isProvider = profile?.account_type === 'provider'
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there'

  const [categories, setCategories] = useState([])
  const [providerProfile, setProviderProfile] = useState(null)
  const [providerLoading, setProviderLoading] = useState(isProvider)

  useEffect(() => {
    let active = true
    supabase?.from('service_categories').select('id, name, slug').order('name')
      .then(({ data }) => {
        if (active) setCategories(data ?? [])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isProvider || !user?.id) {
      setProviderLoading(false)
      return
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
      .catch(() => {
        if (active) setProviderLoading(false)
      })
    return () => {
      active = false
    }
  }, [isProvider, user?.id])

  if (isProvider) {
    const isPublished = Boolean(providerProfile?.is_published)
    const isOnboardingComplete = Boolean(profile?.onboarding_completed_at)

    return (
      <main className="app-page app-home">
        <header className="home-hero">
          <div className="home-hero__copy">
            <h1 className="text-large-title">Good to see you, {firstName}.</h1>
            <p className="home-hero__subtitle">Manage your professional profile and services.</p>
          </div>
        </header>

        <section aria-labelledby="provider-status-title" className="app-section">
          <div className="app-section__heading">
            <h2 id="provider-status-title">Profile status</h2>
          </div>

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
                  <p>
                    {isPublished
                      ? 'Customers can discover your profile, services, and areas.'
                      : 'Complete your profile setup to appear in public searches.'}
                  </p>
                </div>
              </div>

              {!isOnboardingComplete && (
                <div className="home-status-card__action">
                  <Button as={Link} to="/onboarding/provider" variant="primary" wide>
                    Finish your profile
                  </Button>
                </div>
              )}
            </Card>
          )}
        </section>

        <section className="app-section">
          <div className="home-coming-soon-banner" aria-disabled="true">
            <Wrench aria-hidden="true" size={22} />
            <div>
              <strong>Job marketplace coming soon</strong>
              <span>Customer problem requests and bids will appear here once live.</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="provider-discovery-title" className="app-section">
          <div className="app-section__heading">
            <h2 id="provider-discovery-title">Professionals on Fixora</h2>
            <Link className="app-text-link" to="/app/discover">
              Explore all <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <PublishedProfessionals limit={4} />
        </section>
      </main>
    )
  }

  // Customer Home
  return (
    <main className="app-page app-home">
      <header className="home-hero">
        <div className="home-hero__copy">
          <h1 className="text-large-title">Good to see you, {firstName}.</h1>
          <p className="home-hero__subtitle">Find skilled household professionals for your home.</p>
        </div>

        <button
          aria-label="Search for professionals"
          className="home-search-trigger"
          onClick={() => navigate('/app/discover?focus=true')}
          type="button"
        >
          <MagnifyingGlass aria-hidden="true" size={20} />
          <span>Search professionals or services…</span>
        </button>
      </header>

      {categories.length > 0 && (
        <section aria-labelledby="home-categories-title" className="app-section">
          <div className="app-section__heading">
            <h2 id="home-categories-title">Categories</h2>
            <Link className="app-text-link" to="/app/discover">
              See all <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>

          <div className="home-category-grid">
            {categories.slice(0, 6).map((cat) => {
              const Icon = categoryIcons[cat.slug] || Briefcase
              return (
                <Link
                  className="home-category-tile"
                  key={cat.id}
                  to={`/app/discover?category=${cat.slug}`}
                >
                  <span className="home-category-tile__icon">
                    <Icon aria-hidden="true" size={22} weight="duotone" />
                  </span>
                  <span className="home-category-tile__name">{cat.name}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="home-pros-title" className="app-section">
        <div className="app-section__heading">
          <h2 id="home-pros-title">Professionals</h2>
          <Link className="app-text-link" to="/app/discover">
            See all <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <PublishedProfessionals limit={4} />
      </section>

      <section className="app-section">
        <div aria-disabled="true" className="home-coming-soon-banner">
          <div>
            <strong>Post a problem · Coming soon</strong>
            <span>Posting a problem is coming soon.</span>
          </div>
        </div>
      </section>
    </main>
  )
}
