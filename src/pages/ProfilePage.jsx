import { useCallback, useEffect, useState } from 'react'
import { Briefcase } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import SignOutAction from '../components/SignOutAction.jsx'
import { Avatar, Card, ListGroup, ListRow } from '../components/UiPrimitives.jsx'
import ProviderWorkSummary from '../components/ProviderWorkSummary.jsx'
import './AuthenticatedPages.css'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const [provider, setProvider] = useState(null)
  const isProvider = profile?.account_type === 'provider'
  const [loading, setLoading] = useState(isProvider)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const loadProvider = useCallback(async () => {
    if (!isProvider || !user?.id) {
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
  }, [isProvider, user?.id])

  useEffect(() => {
    loadProvider()
  }, [loadProvider, attempt])

  const displayName = profile?.full_name || (isProvider ? provider?.display_name : 'Fixora account') || 'Fixora account'
  const services = (provider?.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
  const areas = (provider?.provider_service_areas ?? []).map((area) => [area.city, area.region].filter(Boolean).join(', ')).filter(Boolean)

  return (
    <main className="app-page app-page--profile">
      <header className="app-page__heading">
        <h1 className="text-large-title">Profile</h1>
      </header>
      <header className="profile-hero">
        <Avatar name={displayName} size={72} />
        <div className="profile-hero__meta">
          <h2 className="profile-hero__name">{displayName}</h2>
          <p className="profile-hero__email">{user?.email || 'Authenticated account'}</p>
        </div>
      </header>

      <section className="app-profile-section">
        <h2 className="app-group-title">Account details</h2>
        <ListGroup>
          <ListRow icon={Briefcase} value={isProvider ? 'Professional' : 'Customer'}>
            Account type
          </ListRow>
        </ListGroup>
      </section>

      {isProvider && (
        <section className="app-profile-section">
          <h2 className="app-group-title">Professional profile</h2>
          {loading ? (
            <Card><p className="app-muted">Loading your professional details…</p></Card>
          ) : error ? (
            <Card>
              <p className="app-muted">Could not load your professional details.</p>
              <button className="ui-text-link" onClick={() => setAttempt((v) => v + 1)} type="button">
                Try again
              </button>
            </Card>
          ) : provider ? (
            <ListGroup>
              <ListRow value={provider.display_name}>Business / Trade name</ListRow>
              <ListRow value={provider.provider_type === 'business' ? 'Business' : 'Individual'}>
                Type
              </ListRow>
              <ListRow value={provider.is_published ? 'Published' : 'Draft'}>
                Visibility
              </ListRow>
              <ListRow value={services.length ? services.join(', ') : 'None listed'}>
                Services
              </ListRow>
              <ListRow value={areas.length ? areas.join(' · ') : 'None listed'}>
                Locations
              </ListRow>
            </ListGroup>
          ) : (
            <Card>
              <p className="app-muted">Professional profile is still in progress.</p>
            </Card>
          )}
        </section>
      )}

      {isProvider && provider && <ProviderWorkSummary displayName={provider.display_name} profileId={provider.profile_id} />}

      <section className="app-profile-section">
        <h2 className="app-group-title">About Fixora</h2>
        <ListGroup>
          <ListRow value="v0.1.0">App version</ListRow>
        </ListGroup>
      </section>

      <section className="app-profile-section app-profile-section--danger">
        <h2 className="app-group-title">Session</h2>
        <ListGroup>
          <SignOutAction location="profile" />
        </ListGroup>
      </section>

      <footer className="profile-quiet-footer">
        <p>Profile editing and customer history are coming in a future release.</p>
      </footer>
    </main>
  )
}
