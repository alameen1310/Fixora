import { useCallback, useEffect, useRef, useState } from 'react'
import { CaretRight, MapPin, Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import { avatarUrl } from '../lib/avatarImages.js'
import { appQueryCache } from '../lib/postListCache.js'
import { Avatar, Badge, Button, Skeleton } from './UiPrimitives.jsx'
import { usePresence } from './PresenceProvider.jsx'
import './PublishedProfessionals.css'

export default function PublishedProfessionals({ categorySlug = '', limit = 12, onCountChange, query = '', userId = 'public' }) {
  const cacheKey = `${userId}:discover:professionals:${limit}`
  const cached = appQueryCache.get(cacheKey)
  const [profiles, setProfiles] = useState(() => cached?.profiles ?? [])
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const lastRefreshAt = useRef(cached?.lastRefreshAt || 0)
  const { isOnline, refreshPresence } = usePresence()

  const loadProfiles = useCallback(async ({ silent = false } = {}) => {
    if (!supabase) {
      setError(true)
      setLoading(false)
      return
    }

    if (!silent) { setLoading(true); setError(false) }
    const startedAt = performance.now()
    try {
      const { data, error: queryError } = await supabase
        .from('provider_profiles')
        .select(publishedProviderSelection)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (queryError) throw queryError
      const providerIds = (data ?? []).map((provider) => provider.profile_id)
      const { data: ratings, error: ratingsError } = providerIds.length
        ? await supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').in('provider_id', providerIds)
        : { data: [], error: null }
      if (ratingsError) throw ratingsError
      const summaryById = Object.fromEntries((ratings ?? []).map((summary) => [summary.provider_id, summary]))
      const nextProfiles = (data ?? []).map((provider) => ({ ...provider, rating: summaryById[provider.profile_id] ?? null }))
      setProfiles(nextProfiles)
      lastRefreshAt.current = Date.now()
      appQueryCache.set(cacheKey, { profiles: nextProfiles, lastRefreshAt: lastRefreshAt.current })
      if (import.meta.env.DEV) console.info('[query-timing] Discover providers', { durationMs: Math.round(performance.now() - startedAt), rows: nextProfiles.length })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, limit])

  useEffect(() => {
    if (!cached) void loadProfiles()
    else if (Date.now() - lastRefreshAt.current >= 60_000) void loadProfiles({ silent: true })
  }, [loadProfiles, cached, attempt])
  useEffect(() => {
    const refresh = () => { void loadProfiles({ silent: true }) }
    window.addEventListener('fixora:discover-refresh', refresh)
    return () => window.removeEventListener('fixora:discover-refresh', refresh)
  }, [loadProfiles])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && Date.now() - lastRefreshAt.current >= 60_000) void loadProfiles({ silent: true }) }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [loadProfiles])
  useEffect(() => { void refreshPresence(profiles.map((provider) => provider.profile_id)) }, [profiles, refreshPresence])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredProfiles = profiles.filter((provider) => {
    const categories = (provider.provider_service_categories ?? []).map((relation) => relation.category)
    const matchesCategory = !categorySlug || categories.some((category) => category?.slug === categorySlug)
    if (!matchesCategory) return false
    if (!normalizedQuery) return true
    const searchable = [
      provider.display_name,
      provider.service_description,
      ...categories.map((category) => category?.name),
      ...(provider.provider_service_areas ?? []).flatMap((area) => [area.city, area.region]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return searchable.includes(normalizedQuery)
  })

  useEffect(() => {
    onCountChange?.(filteredProfiles.length, loading, error)
  }, [filteredProfiles.length, loading, error, onCountChange])

  if (loading) {
    return (
      <div aria-label="Loading professionals" aria-live="polite" className="professional-feed professional-feed--loading" role="status">
        <div className="professional-card professional-card--skeleton">
          <div className="professional-card__identity">
            <Skeleton className="professional-skeleton-avatar" />
            <div className="professional-skeleton-meta"><Skeleton /><Skeleton /></div>
          </div>
          <Skeleton className="professional-skeleton-body" />
        </div>
        <div className="professional-card professional-card--skeleton">
          <div className="professional-card__identity">
            <Skeleton className="professional-skeleton-avatar" />
            <div className="professional-skeleton-meta"><Skeleton /><Skeleton /></div>
          </div>
          <Skeleton className="professional-skeleton-body" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="professional-feed__state" role="alert">
        <p>We couldn’t load professional profiles.</p>
        <span>Check your connection and try again.</span>
        <Button onClick={() => setAttempt((value) => value + 1)} variant="secondary">Try again</Button>
      </div>
    )
  }

  if (!filteredProfiles.length) {
    return (
      <div className="professional-feed__state">
        <p>No professionals match your filters.</p>
        <span>Try selecting another service or clearing your search.</span>
      </div>
    )
  }

  return (
    <div aria-label="Published professional profiles" className="professional-feed">
      {filteredProfiles.map((provider) => {
        const services = (provider.provider_service_categories ?? [])
          .map((relation) => relation.category?.name)
          .filter(Boolean)
        const areas = provider.is_nationwide ? ['Nationwide'] : (provider.provider_service_areas ?? [])
          .map((area) => [area.city, area.region].filter(Boolean).join(', '))
          .filter(Boolean)

        const visibleServices = services.slice(0, 4)
        const remainingServices = Math.max(0, services.length - visibleServices.length)

        return (
          <Link
            aria-label={`View ${provider.display_name}'s profile`}
            className="professional-card"
            key={provider.profile_id}
            to={`/app/professionals/${provider.profile_id}`}
          >
            <div className="professional-card__identity">
              <Avatar name={provider.display_name} size={56} src={avatarUrl(provider.avatar_path)} presence={isOnline(provider.profile_id)} />
              <div className="professional-card__titles">
                <h3>{provider.display_name}</h3>
                <div className="professional-card__signals">{Number(provider.rating?.review_count) > 0 ? <span className="professional-card__rating"><Star aria-hidden="true" size={14} weight="fill" />{Number(provider.rating.average_rating).toFixed(1)} ({provider.rating.review_count})</span> : <span className="professional-card__rating-empty">No reviews yet</span>}<Badge tone={provider.availability === 'busy' ? 'neutral' : 'success'}>{provider.availability === 'busy' ? 'Busy' : 'Available'}</Badge></div>
              </div>
              <CaretRight aria-hidden="true" className="professional-card__chevron" size={18} />
            </div>

            <div className="professional-card__footer">
              {services.length > 0 && (
                <div className="professional-card__services">
                  {visibleServices.map((service) => <span className="professional-service-chip" key={service}>{service}</span>)}
                  {remainingServices > 0 && <span className="professional-service-chip">+{remainingServices}</span>}
                </div>
              )}
              {provider.service_description?.trim() && <p className="professional-card__description">{provider.service_description.trim()}</p>}
              {areas.length > 0 && (
                <div className="professional-card__areas">
                  <MapPin aria-hidden="true" size={15} />
                  <span>{areas.slice(0, 2).join(' · ')}</span>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
