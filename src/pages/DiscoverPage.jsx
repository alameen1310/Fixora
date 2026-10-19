import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, XCircle } from '@phosphor-icons/react'
import PublishedProfessionals from '../components/PublishedProfessionals.jsx'
import { Chip } from '../components/UiPrimitives.jsx'
import { supabase } from '../lib/supabase.js'
import './AuthenticatedPages.css'

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || ''
  const initialQuery = searchParams.get('q') || ''

  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [query, setQuery] = useState(initialQuery)
  const [resultCount, setResultCount] = useState(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    let active = true
    supabase?.from('service_categories').select('name, slug').order('name')
      .then(({ data }) => {
        if (active) setCategories(data ?? [])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('focus') === 'true') {
      searchInputRef.current?.focus()
    }
  }, [searchParams])

  function handleCategorySelect(slug) {
    const nextSlug = selectedCategory === slug ? '' : slug
    setSelectedCategory(nextSlug)
    const nextParams = new URLSearchParams(searchParams)
    if (nextSlug) nextParams.set('category', nextSlug)
    else nextParams.delete('category')
    nextParams.delete('focus')
    setSearchParams(nextParams, { replace: true })
  }

  function handleQueryChange(event) {
    const nextValue = event.target.value
    setQuery(nextValue)
    const nextParams = new URLSearchParams(searchParams)
    if (nextValue.trim()) nextParams.set('q', nextValue)
    else nextParams.delete('q')
    nextParams.delete('focus')
    setSearchParams(nextParams, { replace: true })
  }

  function clearAllFilters() {
    setSelectedCategory('')
    setQuery('')
    setSearchParams({}, { replace: true })
    searchInputRef.current?.focus()
  }

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <h1 className="text-large-title">Discover professionals</h1>
        <p>Explore published profiles and service areas across Nigeria.</p>
      </header>

      <div className="discover-search-wrap">
        <label className="app-search-field" htmlFor="discover-search">
          <MagnifyingGlass aria-hidden="true" size={20} />
          <span className="visually-hidden">Search professionals</span>
          <input
            id="discover-search"
            onChange={handleQueryChange}
            placeholder="Search by name, service, or city"
            ref={searchInputRef}
            type="search"
            value={query}
          />
          {query && (
            <button
              aria-label="Clear search query"
              className="discover-search-clear"
              onClick={() => {
                setQuery('')
                const next = new URLSearchParams(searchParams)
                next.delete('q')
                setSearchParams(next, { replace: true })
              }}
              type="button"
            >
              <XCircle aria-hidden="true" size={18} weight="fill" />
            </button>
          )}
        </label>
      </div>

      <div aria-label="Filter by service category" className="discover-category-chips" role="group">
        <Chip
          onClick={() => handleCategorySelect('')}
          selected={!selectedCategory}
        >
          All services
        </Chip>
        {categories.map((category) => (
          <Chip
            key={category.slug}
            onClick={() => handleCategorySelect(category.slug)}
            selected={selectedCategory === category.slug}
          >
            {category.name}
          </Chip>
        ))}
      </div>

      <section aria-labelledby="discover-pros-title" className="app-section">
        <div className="app-section__heading">
          <h2 id="discover-pros-title">Available professionals</h2>
          {resultCount !== null && (
            <span className="discover-results-count">
              {resultCount} {resultCount === 1 ? 'professional' : 'professionals'}
            </span>
          )}
        </div>

        <PublishedProfessionals
          categorySlug={selectedCategory}
          onCountChange={(count) => setResultCount(count)}
          query={query}
        />

        {(selectedCategory || query) && resultCount === 0 && (
          <div className="discover-empty-actions">
            <button className="ui-button ui-button--secondary" onClick={clearAllFilters} type="button">
              Clear filters
            </button>
          </div>
        )}
      </section>

      <footer className="discover-upcoming-note">
        <p>Customer problem posting and completed projects are coming in a future release.</p>
      </footer>
    </main>
  )
}
