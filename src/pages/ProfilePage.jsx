import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Briefcase, MapPin, Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import SignOutAction from '../components/SignOutAction.jsx'
import { Badge, Chip, ListGroup, ListRow, Skeleton } from '../components/UiPrimitives.jsx'
import ProviderWorkSummary from '../components/ProviderWorkSummary.jsx'
import ProfilePhotoField from '../components/ProfilePhotoField.jsx'
import './AuthenticatedPages.css'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const [provider, setProvider] = useState(null)
  const isProvider = profile?.account_type === 'provider'
  const [loading, setLoading] = useState(isProvider)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [providerStats, setProviderStats] = useState(null)

  const loadProvider = useCallback(async () => {
    if (!isProvider || !user?.id) { setLoading(false); return }
    setLoading(true); setError(false)
    try {
      const { data, error: queryError } = await supabase.from('provider_profiles').select(publishedProviderSelection).eq('profile_id', user.id).maybeSingle()
      if (queryError) throw queryError
      setProvider(data)
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [isProvider, user?.id])
  useEffect(() => { void loadProvider() }, [loadProvider, attempt])

  const displayName = profile?.full_name || (isProvider ? provider?.display_name : 'Fixora account') || 'Fixora account'
  const services = (provider?.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
  const areas = provider?.is_nationwide ? ['Nationwide · Nigeria'] : (provider?.provider_service_areas ?? []).map((area) => [area.city, area.region].filter(Boolean).join(', ')).filter(Boolean)

  if (isProvider) return <main className="app-page app-page--profile provider-profile-page">
    <ProfileNavigation />
    {loading ? <div className="provider-profile-layout"><section><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 280, marginTop: 20 }} /></section><Skeleton style={{ height: 360 }} /></div>
      : error ? <section className="posts-feed__error" role="alert"><h2>Profile didn’t load</h2><ButtonRetry onRetry={() => setAttempt((value) => value + 1)} /></section>
        : provider ? <div className="provider-profile-layout">
          <section className="provider-profile-main">
            <header className="provider-profile-identity"><ProfilePhotoField name={provider.display_name} size={68} /><div><div className="provider-profile-identity__heading"><h2>{provider.display_name}</h2><Badge tone={provider.is_published ? 'success' : 'neutral'}>{provider.is_published ? 'Live' : 'Draft'}</Badge></div><p>{provider.provider_type === 'business' ? 'Service business' : 'Independent professional'}<span>·</span>{user?.email}</p></div></header>
            <section className="provider-profile-details"><div><strong>Services</strong><div className="provider-profile-chips">{services.length ? services.map((service) => <Chip key={service}>{service}</Chip>) : <span>Services not added yet</span>}</div></div><div><strong>Areas</strong><div className="provider-profile-chips">{areas.length ? areas.map((area) => <Chip key={area}><MapPin aria-hidden="true" size={14} />{area}</Chip>) : <span>Areas not added yet</span>}</div></div></section>
            <ProviderWorkSummary displayName={provider.display_name} onSummaryChange={setProviderStats} profileId={provider.profile_id} showReputation={false} />
          </section>
          <aside className="provider-profile-rail">
            <section className="provider-profile-stats"><div><span>Overall rating</span><strong>{Number(providerStats?.summary?.review_count) ? Number(providerStats.summary.average_rating).toFixed(1) : '–'}</strong>{Number(providerStats?.summary?.review_count) ? <small><Star aria-hidden="true" size={14} weight="fill" />{providerStats.summary.review_count} reviews</small> : <small>No reviews yet</small>}</div><div><span>Jobs completed</span><strong>{providerStats?.jobs ?? '–'}</strong></div>{Number(providerStats?.earned) > 0 && <div><span>Earned</span><strong>₦{Number(providerStats.earned).toLocaleString('en-NG')}</strong></div>}</section>
            <section className="provider-profile-side-card"><h2>About</h2><p>{provider.service_description?.trim() || 'Add a short description of your services.'}</p></section>
            <section className="provider-profile-side-card"><h2>Session</h2><ListGroup><SignOutAction location="profile" /></ListGroup></section>
          </aside>
        </div> : <section className="provider-profile-empty"><h2>Set up your professional profile</h2><p>Add a trade name, services and work areas to get started.</p><Link to="/onboarding/provider">Complete profile</Link></section>}
  </main>

  return <main className="app-page app-page--profile">
    <ProfileNavigation />
    <header className="profile-hero"><ProfilePhotoField name={displayName} size={72} /><div className="profile-hero__meta"><h2 className="profile-hero__name">{displayName}</h2><p className="profile-hero__email">{user?.email || 'Authenticated account'}</p></div></header>
    <section className="app-profile-section"><h2 className="app-group-title">Account</h2><ListGroup><ListRow icon={Briefcase} value="Customer">Account type</ListRow></ListGroup></section>
    <section className="app-profile-section"><h2 className="app-group-title">About Fixora</h2><ListGroup><ListRow value="v0.1.0">App version</ListRow></ListGroup></section>
    <section className="app-profile-section app-profile-section--danger"><h2 className="app-group-title">Session</h2><ListGroup><SignOutAction location="profile" /></ListGroup></section>
  </main>
}

function ProfileNavigation() { return <header className="mobile-subpage-nav"><Link aria-label="Back to Home" to="/app"><ArrowLeft aria-hidden="true" size={20} /><span>Home</span></Link><h1>Profile</h1><Link className="profile-edit-link" to="/profile/edit">Edit</Link></header> }

function ButtonRetry({ onRetry }) { return <button className="ui-button ui-button--secondary" onClick={onRetry} type="button">Try again</button> }
