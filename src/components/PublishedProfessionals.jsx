import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Briefcase, MapPin, Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import './PublishedProfessionals.css'

export default function PublishedProfessionals({ limit = 12 }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const loadProfiles = useCallback(async () => {
    if (!supabase) {
      setError(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)
    try {
      const { data, error: queryError } = await supabase
        .from('provider_profiles')
        .select(publishedProviderSelection)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (queryError) throw queryError
      setProfiles(data ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => { loadProfiles() }, [loadProfiles, attempt])

  if (loading) return <p className="professional-feed__status" role="status">Finding Fixora professionals…</p>
  if (error) {
    return (
      <div className="professional-feed__state" role="alert">
        <p>We couldn’t load professional profiles just now.</p>
        <button onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button>
      </div>
    )
  }
  if (!profiles.length) {
    return (
      <div className="professional-feed__state">
        <p>Professional profiles will appear here as Fixora’s community grows.</p>
        <span>There are no published profiles to show yet.</span>
      </div>
    )
  }

  return (
    <div aria-label="Published professional profiles" className="professional-feed">
      {profiles.map((provider) => {
        const services = (provider.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
        const areas = (provider.provider_service_areas ?? []).map((area) => [area.city, area.region].filter(Boolean).join(', ')).filter(Boolean)
        return (
          <article className="professional-card" key={provider.profile_id}>
            <div className="professional-card__identity">
              <span aria-hidden="true" className="professional-card__mark"><Briefcase size={21} weight="duotone" /></span>
              <div><p className="professional-card__eyebrow">{provider.provider_type === 'business' ? 'Service business' : 'Independent professional'}</p><h3><Link to={'/app/professionals/' + provider.profile_id}>{provider.display_name}<ArrowUpRight aria-hidden="true" size={17} /></Link></h3></div>
            </div>
            {provider.service_description && <p className="professional-card__description">{provider.service_description}</p>}
            {services.length > 0 && <div className="professional-card__services"><Wrench aria-hidden="true" size={16} /><span>{services.join(' · ')}</span></div>}
            {areas.length > 0 && <div className="professional-card__areas"><MapPin aria-hidden="true" size={16} /><span>{areas.join(' · ')}</span></div>}
            {!services.length && !areas.length && <p className="professional-card__note">More profile details are being added.</p>}
          </article>
        )
      })}
    </div>
  )
}
