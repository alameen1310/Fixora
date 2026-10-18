import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, MapPin, Wrench } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import './AuthenticatedPages.css'

export default function ProfessionalProfilePage() {
  const { professionalId } = useParams()
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { data, error: queryError } = await supabase
        .from('provider_profiles')
        .select(publishedProviderSelection)
        .eq('profile_id', professionalId)
        .eq('is_published', true)
        .maybeSingle()
      if (queryError) throw queryError
      setProvider(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [professionalId])

  useEffect(() => { loadProfile() }, [loadProfile, attempt])

  const services = (provider?.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
  const areas = (provider?.provider_service_areas ?? []).map((area) => [area.city, area.region, area.country_code].filter(Boolean).join(', ')).filter(Boolean)

  return (
    <main className="app-page app-professional-profile">
      <Link className="app-back-link" to="/app/discover"><ArrowLeft aria-hidden="true" size={18} />Back to discovery</Link>
      {loading ? <p className="app-muted" role="status">Loading public profile…</p> : error ? (
        <section className="app-unavailable-state" role="alert"><h1>We couldn’t load this profile.</h1><p>Check your connection and try again.</p><button className="app-secondary-action" onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button></section>
      ) : !provider ? (
        <section className="app-unavailable-state"><p className="app-eyebrow">Professional profile</p><h1>This profile isn’t available.</h1><p>It may no longer be published, or it may not exist.</p><Link className="app-secondary-action" to="/app/discover">Explore profiles</Link></section>
      ) : (
        <article className="app-public-profile">
          <header className="app-public-profile__header">
            <span className="app-public-profile__mark"><Briefcase aria-hidden="true" size={28} weight="duotone" /></span>
            <div><p className="app-eyebrow">{provider.provider_type === 'business' ? 'Service business' : 'Independent professional'}</p><h1>{provider.display_name}</h1></div>
          </header>
          <p className="app-public-profile__description">{provider.service_description || 'This professional has not added a description yet.'}</p>
          <div className="app-public-profile__facts">
            <section><h2><Wrench aria-hidden="true" size={19} /> Services</h2><p>{services.length ? services.join(' · ') : 'No services listed.'}</p></section>
            <section><h2><MapPin aria-hidden="true" size={19} /> Service areas</h2><p>{areas.length ? areas.join(' · ') : 'No service areas listed.'}</p></section>
          </div>
          <p className="app-public-profile__note">Portfolio work, reviews, and direct contact options are not available yet.</p>
        </article>
      )}
    </main>
  )
}
