import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Briefcase, MapPin, Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import SignOutAction from '../components/SignOutAction.jsx'
import { Avatar, Badge, Chip, ListGroup, ListRow, Skeleton } from '../components/UiPrimitives.jsx'
import ProviderWorkSummary from '../components/ProviderWorkSummary.jsx'
import { avatarUrl } from '../lib/avatarImages.js'
import { usePresence } from '../components/PresenceProvider.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import ProfileCompleteness from '../components/ProfileCompleteness.jsx'
import './AuthenticatedPages.css'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const { showStatus, setShowStatus } = usePresence()
  const { showToast } = useToast()
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
  const areas = provider?.is_nationwide ? ['Nationwide'] : (provider?.provider_service_areas ?? []).map((area) => [area.city, area.region].filter(Boolean).join(', ')).filter(Boolean)

  if (isProvider) return <main className="app-page app-page--profile provider-profile-page">
    <ProfileNavigation />
    {loading ? <div className="provider-profile-layout"><section><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 280, marginTop: 20 }} /></section><Skeleton style={{ height: 360 }} /></div>
      : error ? <section className="posts-feed__error" role="alert"><h2>Profile didn’t load</h2><ButtonRetry onRetry={() => setAttempt((value) => value + 1)} /></section>
        : provider ? <div className="provider-profile-layout">
          <section className="provider-profile-main">
            <ProfileCompleteness profile={profile} provider={provider} />
            <header className="provider-profile-identity"><Avatar name={provider.display_name} size={68} src={avatarUrl(provider.avatar_path || profile?.avatar_path)} /><div><div className="provider-profile-identity__heading"><h2>{provider.display_name}</h2><Badge tone={provider.is_published ? 'success' : 'neutral'}>{provider.is_published ? 'Live' : 'Draft'}</Badge></div><p>{provider?.availability === 'busy' ? 'Busy' : 'Available'}<span>·</span>{user?.email}</p><Link className="app-text-link" to="/app/profile/edit">Edit profile</Link></div></header>
            <section className="provider-profile-details"><div><strong>Services</strong><div className="provider-profile-chips">{services.length ? services.map((service) => <Chip key={service}>{service}</Chip>) : <span>Services not added yet</span>}</div></div><div><strong>Areas</strong><div className="provider-profile-chips">{areas.length ? areas.map((area) => <Chip key={area}><MapPin aria-hidden="true" size={14} />{area}</Chip>) : <span>Areas not added yet</span>}</div></div></section>
            <ProviderWorkSummary avatarPath={provider.avatar_path} displayName={provider.display_name} onSummaryChange={setProviderStats} profileId={provider.profile_id} showReputation={false} />
          </section>
          <aside className="provider-profile-rail">
            <section className="provider-profile-stats"><div><span>Overall rating</span><strong>{Number(providerStats?.summary?.review_count) ? Number(providerStats.summary.average_rating).toFixed(1) : '–'}</strong>{Number(providerStats?.summary?.review_count) ? <small><Star aria-hidden="true" size={14} weight="fill" />{providerStats.summary.review_count} reviews</small> : <small>No reviews yet</small>}</div><div><span>Jobs completed</span><strong>{providerStats?.jobs ?? '–'}</strong></div>{Number(providerStats?.earned) > 0 && <div><span>Earned</span><strong>₦{Number(providerStats.earned).toLocaleString('en-NG')}</strong></div>}</section>
            <section className="provider-profile-side-card"><h2>About</h2><p>{provider.service_description?.trim() || 'Add a short description of your services.'}</p></section>
            <section className="provider-profile-side-card"><h2>Privacy</h2><PresenceSetting showStatus={showStatus} onChange={async (value) => { try { await setShowStatus(value); showToast({ type: 'success', message: value ? 'Online status is visible.' : 'Online status is hidden.' }) } catch { showToast({ type: 'error', message: 'Privacy setting could not be saved.' }) } }} /></section>
            <section className="provider-profile-side-card"><h2>Session</h2><ListGroup><SignOutAction location="profile" /></ListGroup></section>
          </aside>
        </div> : <section className="provider-profile-empty"><h2>Set up your professional profile</h2><p>Add a trade name, services and work areas to get started.</p><Link to="/onboarding/provider">Complete profile</Link></section>}
  </main>

  return <main className="app-page app-page--profile">
    <ProfileNavigation />
    <header className="profile-hero"><Avatar name={displayName} size={72} src={avatarUrl(profile?.avatar_path)} /><div className="profile-hero__meta"><h2 className="profile-hero__name">{displayName}</h2><p className="profile-hero__email">{user?.email || 'Authenticated account'}</p><p className="profile-hero__email">{[profile?.location_city, profile?.location_region].filter(Boolean).join(', ') || 'Location not added'}{profile?.created_at && ` · Member since ${new Intl.DateTimeFormat('en-NG', { month: 'short', year: 'numeric' }).format(new Date(profile.created_at))}`}</p><Link className="app-text-link" to="/app/profile/edit">Edit profile</Link></div></header>
    <section className="app-profile-section"><h2 className="app-group-title">Account</h2><ListGroup><ListRow icon={Briefcase} value="Customer">Account type</ListRow></ListGroup></section>
    <section className="app-profile-section"><h2 className="app-group-title">About Fixora</h2><ListGroup><ListRow value="v0.1.0">App version</ListRow></ListGroup></section>
    <section className="app-profile-section"><h2 className="app-group-title">Privacy</h2><PresenceSetting showStatus={showStatus} onChange={async (value) => { try { await setShowStatus(value); showToast({ type: 'success', message: value ? 'Online status is visible.' : 'Online status is hidden.' }) } catch { showToast({ type: 'error', message: 'Privacy setting could not be saved.' }) } }} /></section>
    <section className="app-profile-section app-profile-section--danger"><h2 className="app-group-title">Session</h2><ListGroup><SignOutAction location="profile" /></ListGroup></section>
  </main>
}

function ProfileNavigation() { return <header className="mobile-subpage-nav"><Link aria-label="Back to Home" to="/app"><ArrowLeft aria-hidden="true" size={20} /><span>Home</span></Link><h1>Profile</h1><span aria-hidden="true" /> </header> }

function PresenceSetting({ showStatus, onChange }) { return <label className="profile-presence-setting"><span><strong>Show my online status</strong><small>When off, others won’t see an online dot or last-seen time.</small></span><input checked={showStatus} onChange={(event) => void onChange(event.target.checked)} role="switch" type="checkbox" /></label> }

function ButtonRetry({ onRetry }) { return <button className="ui-button ui-button--secondary" onClick={onRetry} type="button">Try again</button> }
