import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Wrench } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { publishedProviderSelection } from '../lib/providerQueries.js'
import { Avatar, Badge, Button, Chip, ListGroup, ListRow, Skeleton } from '../components/UiPrimitives.jsx'
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

  useEffect(() => {
    loadProfile()
  }, [loadProfile, attempt])

  const services = (provider?.provider_service_categories ?? []).map((relation) => relation.category?.name).filter(Boolean)
  const areas = (provider?.provider_service_areas ?? []).map((area) => [area.city, area.region].filter(Boolean).join(', ')).filter(Boolean)

  return (
    <main className="app-page app-page--profile-detail">
      <div className="app-nav-back">
        <Link aria-label="Back to discovery" className="app-back-link" to="/app/discover">
          <ArrowLeft aria-hidden="true" size={20} weight="bold" />
          <span>Discover</span>
        </Link>
      </div>

      {loading ? (
        <article className="app-public-profile app-public-profile--skeleton" aria-busy="true">
          <header className="app-public-profile__header">
            <Skeleton className="app-profile-avatar-skeleton" />
            <div className="app-profile-header-meta">
              <Skeleton style={{ width: '40%', height: '1rem' }} />
              <Skeleton style={{ width: '70%', height: '1.8rem', marginTop: '0.4rem' }} />
            </div>
          </header>
          <Skeleton style={{ width: '100%', height: '4rem', marginTop: '1.5rem' }} />
        </article>
      ) : error ? (
        <section className="app-unavailable-state" role="alert">
          <h2>We couldn’t load this profile.</h2>
          <p>Please check your internet connection and try again.</p>
          <Button onClick={() => setAttempt((value) => value + 1)} variant="secondary">
            Try again
          </Button>
        </section>
      ) : !provider ? (
        <section className="app-unavailable-state">
          <h2>Profile unavailable</h2>
          <p>This profile may have been unpublished or does not exist.</p>
          <Button as={Link} to="/app/discover" variant="primary">
            Back to discovery
          </Button>
        </section>
      ) : (
        <article className="app-public-profile">
          <header className="app-public-profile__header">
            <Avatar name={provider.display_name} size={64} />
            <div className="app-public-profile__titles">
              <Badge tone="neutral">
                {provider.provider_type === 'business' ? 'Service business' : 'Independent professional'}
              </Badge>
              <h1>{provider.display_name}</h1>
            </div>
          </header>

          {provider.service_description && (
            <div className="app-public-profile__section">
              <h2 className="app-section-title">About the work</h2>
              <p className="app-public-profile__description">{provider.service_description}</p>
            </div>
          )}

          <div className="app-public-profile__section">
            <h2 className="app-section-title">Services offered</h2>
            {services.length ? (
              <div className="app-public-profile__chips">
                {services.map((service) => (
                  <Chip key={service} selected>{service}</Chip>
                ))}
              </div>
            ) : (
              <p className="app-muted">No specific services listed yet.</p>
            )}
          </div>

          <div className="app-public-profile__section">
            <h2 className="app-section-title">Service locations</h2>
            {areas.length ? (
              <ListGroup>
                {areas.map((area) => (
                  <ListRow icon={MapPin} key={area}>
                    {area}
                  </ListRow>
                ))}
              </ListGroup>
            ) : (
              <p className="app-muted">No specific areas listed yet.</p>
            )}
          </div>

          <div className="app-public-profile__contact-card">
            <div className="app-contact-notice">
              <Wrench aria-hidden="true" size={20} />
              <div>
                <strong>Direct contact is coming soon</strong>
                <span>Job requests and contact tools are coming in an upcoming release.</span>
              </div>
            </div>
          </div>
        </article>
      )}
    </main>
  )
}
