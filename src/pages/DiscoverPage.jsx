import { useEffect, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import PublishedProfessionals from '../components/PublishedProfessionals.jsx'
import { supabase } from '../lib/supabase.js'
import './AuthenticatedPages.css'

export default function DiscoverPage() {
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    supabase?.from('service_categories').select('name, slug').order('name')
      .then(({ data }) => { if (active) setCategories(data ?? []) })
    return () => { active = false }
  }, [])

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <h1>Find the work and people that fit.</h1>
        <p>Explore public professional profiles. Requests and project stories are coming later.</p>
      </header>

      <label className="app-search-field" htmlFor="discover-search"><MagnifyingGlass aria-hidden="true" size={20} /><span className="visually-hidden">Search professionals</span><input id="discover-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search professionals or locations" type="search" value={query} /></label>
      <div aria-label="Filter by service" className="app-filter-tabs app-filter-tabs--categories">
        <button aria-pressed={!selectedCategory} className={!selectedCategory ? 'is-selected' : ''} onClick={() => setSelectedCategory('')} type="button">All services</button>
        {categories.map((category) => <button aria-pressed={selectedCategory === category.slug} className={selectedCategory === category.slug ? 'is-selected' : ''} key={category.slug} onClick={() => setSelectedCategory(category.slug)} type="button">{category.name}</button>)}
      </div>

      <section aria-labelledby="discover-pros-title" className="app-section">
        <div className="app-section__heading"><div><h2 id="discover-pros-title">Professionals</h2></div></div>
        <PublishedProfessionals categorySlug={selectedCategory} query={query} />
      </section>
    </main>
  )
}
