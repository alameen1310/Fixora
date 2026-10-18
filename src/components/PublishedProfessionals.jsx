import { useCallback, useEffect, useState } from 'react'
import { CaretRight, Briefcase, MapPin, Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import { Button, Skeleton } from './UiPrimitives.jsx'
import './PublishedProfessionals.css'

export default function PublishedProfessionals({ categorySlug = '', limit = 12, query = '' }) {
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

  if (loading) return <div aria-label="Loading professionals" aria-live="polite" className="professional-feed professional-feed--loading" role="status"><Skeleton /><Skeleton /><Skeleton /></div>
  if (error) {
    return (
      <div className="professional-feed__state" role="alert">
        <p>We couldn’t load professional profiles just now.</p>
        <Button onClick={() => setAttempt((value) => value + 1)} variant="secondary">Try again</Button>
      </div>
    )
  }
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredProfiles = profiles.filter((provider) => {
    const categories = (provider.provider_service_categories ?? []).map((relation) => relation.category)
    const matchesCategory = !categorySlug || categories.some((category) => category?.slug === categorySlug)
    if (!matchesCategory) return false
    if (!normalizedQuery) return true
    const searchable = [provider.display_name, provider.service_description, ...categories.map((category) => category?.name), ...(provider.provider_service_areas ?? []).flatMap((area) => [area.city, area.region])]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return searchable.includes(normalizedQuery)
  })

  if (!filteredProfiles.length) {
    return (
      <div className="professional-feed__state">
        <p>No professionals match those filters yet.</p>
        <span>Try another service or clear your search.</span>
      </div>
    )
  }

  return (
    <div aria-label="Published professional profiles" className="professional-feed">
      {filteredProfiles.map((provider) => {
        const services = (provider.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
        const areas = (provider.provider_service_areas ?? []).map((area) => [area.city, area.region].filter(Boolean).join(', ')).filter(Boolean)
        return (
          <Link aria-label={`View ${provider.display_name}'s profile`} className="professional-card" key={provider.profile_id} to={`/app/professionals/${provider.profile_id}`}>
            <div className="professional-card__identity">
              <span aria-hidden="true" className="professional-card__mark"><Briefcase size={21} weight="duotone" /></span>
              <div><p className="professional-card__eyebrow">{provider.provider_type === 'business' ? 'Service business' : 'Independent professional'}</p><h3>{provider.display_name}</h3></div><CaretRight aria-hidden="true" className="professional-card__chevron" size={20} />
            </div>
            {provider.service_description && <p className="professional-card__description">{provider.service_description}</p>}
            {services.length > 0 && <div className="professional-card__services"><Wrench aria-hidden="true" size={16} /><span>{services.join(' · ')}</span></div>}
            {areas.length > 0 && <div className="professional-card__areas"><MapPin aria-hidden="true" size={16} /><span>{areas.join(' · ')}</span></div>}
            {!services.length && !areas.length && <p className="professional-card__note">More profile details are being added.</p>}
          </Link>
        )
      })}
    </div>
  )
}
