import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import './AuthenticatedPages.css'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(profile?.account_type === 'provider')
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const loadProvider = useCallback(async () => {
    if (profile?.account_type !== 'provider') {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const { data, error: queryError } = await supabase
        .from('provider_profiles')
        .select(publishedProviderSelection)
        .eq('profile_id', user.id)
        .maybeSingle()
      if (queryError) throw queryError
      setProvider(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [profile?.account_type, user?.id])

  useEffect(() => { loadProvider() }, [loadProvider, attempt])

  const isProvider = profile?.account_type === 'provider'
  const services = (provider?.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
  const areas = (provider?.provider_service_areas ?? []).map((area) => [area.city, area.region, area.country_code].filter(Boolean).join(', ')).filter(Boolean)

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <p className="app-eyebrow">Your account</p>
        <h1>Profile</h1>
        <p>Your account information and the details you’ve shared with Fixora.</p>
      </header>

      <section className="app-profile-panel">
        <div className="app-profile-panel__title"><span className="app-profile-panel__icon"><UserCircle aria-hidden="true" size={23} /></span><div><p className="app-eyebrow">Account details</p><h2>{profile?.full_name || 'Your Fixora account'}</h2></div></div>
        <dl className="app-detail-list">
          <div><dt>Email</dt><dd>{user?.email || 'Not available'}</dd></div>
          <div><dt>Account type</dt><dd>{isProvider ? 'Service professional' : 'Customer'}</dd></div>
          <div><dt>Phone</dt><dd>{profile?.phone_number || 'Not added'}{profile?.phone_number && <span className="app-unverified">Not verified</span>}</dd></div>
        </dl>
      </section>

      {isProvider && (
        <section className="app-profile-panel">
          <div className="app-profile-panel__title"><span className="app-profile-panel__icon"><Briefcase aria-hidden="true" size={22} /></span><div><p className="app-eyebrow">Professional profile</p><h2>What customers can discover</h2></div></div>
          {loading ? <p className="app-muted" role="status">Loading your professional details…</p> : error ? (
            <div className="app-inline-error" role="alert"><p>We couldn’t load your professional details.</p><button onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button></div>
          ) : provider ? (
            <dl className="app-detail-list">
              <div><dt>Profile name</dt><dd>{provider.display_name}</dd></div>
              <div><dt>Profile type</dt><dd>{provider.provider_type === 'business' ? 'Business' : 'Individual'}</dd></div>
              <div><dt>About the work</dt><dd>{provider.service_description || 'No description added.'}</dd></div>
              <div><dt>Services</dt><dd>{services.length ? services.join(', ') : 'No services listed.'}</dd></div>
              <div><dt>Service areas</dt><dd>{areas.length ? areas.join(' · ') : 'No service areas listed.'}</dd></div>
              <div><dt>Visibility</dt><dd>{provider.is_published ? 'Published' : 'Not published'}</dd></div>
            </dl>
          ) : (
            <div className="app-inline-empty"><p>Your professional profile is not available yet.</p><span>Profile editing and setup recovery are not available from this screen.</span></div>
          )}
        </section>
      )}

      <section className="app-profile-footnote">
        <p>Profile editing, customer history, portfolios, and reviews are not available in this release.</p>
        <Link className="app-text-link" to="/app/discover">Back to discovery <ArrowRight aria-hidden="true" size={17} /></Link>
      </section>
    </main>
  )
}
