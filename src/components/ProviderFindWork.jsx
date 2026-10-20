import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase, MagnifyingGlass, SlidersHorizontal, Wrench, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge, Button, Chip, Skeleton } from './UiPrimitives.jsx'
import CompletedWorkFeed from './CompletedWorkFeed.jsx'
import { formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { getPostImageUrl } from '../lib/postImages.js'
import { supabase } from '../lib/supabase.js'
import './ProviderFindWork.css'

const columns = 'id, author_id, title, description, category_id, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, status, created_at, published_at, service_categories(name, slug), problem_post_images(storage_path, sort_order, kind)'
const PAGE_SIZE = 24
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+state$/, '')

export default function ProviderFindWork() {
  const { user } = useAuth()
  const [provider, setProvider] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [categories, setCategories] = useState([])
  const [rows, setRows] = useState([])
  const [applications, setApplications] = useState(new Set())
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [matchesOnly, setMatchesOnly] = useState(true)
  const [minBudget, setMinBudget] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [within, setWithin] = useState('any')
  const [sort, setSort] = useState('newest')
  const [segment, setSegment] = useState('requests')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const cursor = useRef(null)

  useEffect(() => {
    if (!filtersOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape') setFiltersOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape) }
  }, [filtersOpen])

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('provider_profiles').select('profile_id, provider_service_categories(category_id, category:service_categories(id, name, slug)), provider_service_areas(country_code, region)').eq('profile_id', user.id).maybeSingle(),
      supabase.from('service_categories').select('id, name, slug').order('name'),
    ]).then(([providerResult, categoryResult]) => {
      if (providerResult.error) throw providerResult.error
      if (categoryResult.error) throw categoryResult.error
      if (active) { setProvider(providerResult.data); setCategories(categoryResult.data ?? []); setProfileLoaded(true) }
    }).catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [user.id])

  const categoryIds = useMemo(() => (provider?.provider_service_categories ?? []).map(({ category_id }) => category_id), [provider])
  const providerRegions = useMemo(() => new Set((provider?.provider_service_areas ?? []).filter(({ country_code }) => country_code === 'NG').map(({ region }) => normalize(region))), [provider])
  const myCategories = useMemo(() => (provider?.provider_service_categories ?? []).map(({ category }) => category).filter(Boolean), [provider])

  const load = useCallback(async (append = false) => {
    if (!append) { setLoading(true); setError(false); cursor.current = null }
    else setLoadingMore(true)
    try {
      let query = supabase.from('problem_posts').select(columns).eq('status', 'open').not('published_at', 'is', null).neq('author_id', user.id)
      if (category) query = query.eq('category_id', category)
      if (matchesOnly && categoryIds.length) query = query.in('category_id', categoryIds)
      if (within !== 'any') {
        const age = within === '24h' ? 24 : 168
        query = query.gte('created_at', new Date(Date.now() - age * 60 * 60 * 1000).toISOString())
      }
      if (minBudget) query = query.gte('budget_max_naira', Number(minBudget.replaceAll(',', '')))
      if (maxBudget) query = query.lte('budget_min_naira', Number(maxBudget.replaceAll(',', '')))
      if (append && cursor.current && sort === 'newest') query = query.or(`created_at.lt.${cursor.current.created_at},and(created_at.eq.${cursor.current.created_at},id.lt.${cursor.current.id})`)
      if (append && cursor.current && sort === 'budget') {
        query = cursor.current.budget_max_naira === null
          ? query.is('budget_max_naira', null).lt('id', cursor.current.id)
          : query.or(`budget_max_naira.lt.${cursor.current.budget_max_naira},and(budget_max_naira.eq.${cursor.current.budget_max_naira},id.lt.${cursor.current.id}),budget_max_naira.is.null`)
      }
      query = sort === 'budget' ? query.order('budget_max_naira', { ascending: false, nullsFirst: false }) : query.order('created_at', { ascending: false })
      query = query.order('id', { ascending: false }).limit(PAGE_SIZE)
      const { data, error: queryError } = await query
      if (queryError) throw queryError
      let page = data ?? []
      if (matchesOnly) page = page.filter((post) => categoryIds.includes(post.category_id) && providerRegions.has(normalize(post.region)))
      const searchText = search.trim().toLowerCase()
      if (searchText) page = page.filter((post) => [post.title, post.region, post.city, post.service_categories?.name].some((value) => String(value || '').toLowerCase().includes(searchText)))
      if (append) setRows((current) => [...current, ...page.filter((row) => !current.some((old) => old.id === row.id))])
      else setRows(page)
      const last = data?.at(-1)
      cursor.current = last ? { created_at: last.created_at, id: last.id, budget_max_naira: last.budget_max_naira ?? null } : cursor.current
      setHasMore((data?.length ?? 0) === PAGE_SIZE)
      const ids = page.map(({ id }) => id)
      if (ids.length) {
        const { data: applied, error: appError } = await supabase.from('problem_post_applications').select('post_id').eq('professional_id', user.id).in('post_id', ids)
        if (appError) throw appError
        setApplications((current) => new Set([...current, ...(applied ?? []).map(({ post_id }) => post_id)]))
      }
    } catch {
      setError(true)
    } finally { setLoading(false); setLoadingMore(false) }
  }, [user.id, category, matchesOnly, categoryIds, providerRegions, within, minBudget, maxBudget, sort, search])

  useEffect(() => { if (profileLoaded) void load() }, [profileLoaded, load])
  useEffect(() => {
    const refresh = () => { void load() }
    window.addEventListener('fixora:discover-refresh', refresh)
    return () => window.removeEventListener('fixora:discover-refresh', refresh)
  }, [load])
  const displayRows = rows

  function clearFilters() { setSearch(''); setCategory(''); setMinBudget(''); setMaxBudget(''); setWithin('any'); setMatchesOnly(true); setSort('newest') }

  const activeFilterCount = Number(Boolean(category)) + Number(Boolean(minBudget)) + Number(Boolean(maxBudget)) + Number(within !== 'any') + Number(sort !== 'newest')
  const filterControls = <><h2>Filters</h2><div><strong>Service</strong><div className="provider-find-work__chips">{[...myCategories, ...categories.filter((item) => !categoryIds.includes(item.id))].map((item) => <Chip key={item.id} onClick={() => setCategory(category === item.id ? '' : item.id)} selected={category === item.id}>{item.name}</Chip>)}</div></div><div className="provider-find-work__budget"><strong>Budget (₦)</strong><input aria-label="Minimum budget" inputMode="numeric" onChange={(event) => setMinBudget(event.target.value)} placeholder="Min" value={minBudget} /><input aria-label="Maximum budget" inputMode="numeric" onChange={(event) => setMaxBudget(event.target.value)} placeholder="Max" value={maxBudget} /></div><label><span>Posted within</span><select onChange={(event) => setWithin(event.target.value)} value={within}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="any">Any time</option></select></label><label><span>Sort</span><select onChange={(event) => setSort(event.target.value)} value={sort}><option value="newest">Newest</option><option value="budget">Budget high to low</option></select></label><Button onClick={clearFilters} variant="secondary">Clear filters</Button></>

  return <main className="provider-find-work app-page">
    <header className="provider-find-work__header"><h1>Find work</h1><label className="provider-find-work__search"><MagnifyingGlass aria-hidden="true" size={19} /><span className="visually-hidden">Search requests</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search title, service or location" value={search} /></label><label className="provider-find-work__toggle"><input checked={matchesOnly} onChange={(event) => setMatchesOnly(event.target.checked)} type="checkbox" /><span>Matches my services</span></label></header>
    <button aria-expanded={filtersOpen} className="provider-find-work__filter-trigger" onClick={() => setFiltersOpen(true)} type="button"><SlidersHorizontal aria-hidden="true" size={18} />Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
    <div aria-label="Find work sections" className="provider-find-work__segments" role="tablist"><button aria-selected={segment === 'requests'} onClick={() => setSegment('requests')} role="tab" type="button">Open requests</button><button aria-selected={segment === 'completed'} onClick={() => setSegment('completed')} role="tab" type="button">Completed work</button></div>
    {segment === 'completed' ? <CompletedWorkFeed /> : <div className="provider-find-work__layout">
      <aside aria-label="Request filters" className="provider-find-work__filters">{filterControls}</aside>
      <section className="provider-find-work__results" aria-label="Open customer requests">
        {loading ? <div className="provider-find-work__skeletons" role="status" aria-label="Loading requests">{[0,1,2,3].map((item) => <Skeleton key={item} />)}</div> : error ? <section className="provider-find-work__empty"><p>Requests couldn’t load.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section> : displayRows.length ? <div className="provider-find-work__list">{displayRows.map((post) => { const cover = post.problem_post_images?.filter((image) => image.kind === 'before').sort((a,b) => a.sort_order-b.sort_order)[0]?.storage_path; return <Link className="provider-work-row" key={post.id} to={`/app/posts/${post.id}`}><div className="provider-work-row__image">{cover ? <img alt="" src={getPostImageUrl(cover)} /> : <Wrench aria-hidden="true" size={28} />}{applications.has(post.id) && <Badge tone="info">Applied</Badge>}</div><div className="provider-work-row__body"><div className="provider-work-row__heading"><strong>{post.title}</strong><Badge tone="info">{post.service_categories?.name || 'Service'}</Badge></div><strong className="provider-work-row__budget">{formatPostBudget(post)}</strong>{post.description?.trim() && <p className="provider-work-row__description">{post.description.trim()}</p>}<div className="provider-work-row__meta"><span>{[post.city, post.region].filter(Boolean).join(', ') || 'Location not specified'}</span><span>{formatRelativeTime(post.created_at)}</span></div>{categoryIds.includes(post.category_id) && providerRegions.has(normalize(post.region)) && <span className="provider-work-row__match">Matches your services</span>}</div></Link> })}</div> : hasMore ? <section className="provider-find-work__empty"><p>Looking for requests on the next page.</p><Button loading={loadingMore} onClick={() => void load(true)} variant="secondary">Load more requests</Button></section> : <section className="provider-find-work__empty"><Briefcase aria-hidden="true" size={28} /><h2>No requests match your filters</h2><Button onClick={clearFilters} variant="secondary">Clear filters</Button></section>}
        {!loading && !error && displayRows.length > 0 && <div className="provider-find-work__foot"><span>Showing {displayRows.length} requests</span>{hasMore && <Button loading={loadingMore} onClick={() => void load(true)} variant="secondary">Load more</Button>}</div>}
      </section>
    </div>}
    {filtersOpen && <div className="provider-find-work__sheet-layer"><button aria-label="Close filters" className="provider-find-work__sheet-scrim" onClick={() => setFiltersOpen(false)} type="button" /><section aria-labelledby="provider-filter-title" aria-modal="true" className="provider-find-work__sheet" role="dialog"><header><h2 id="provider-filter-title">Filters</h2><button aria-label="Close filters" onClick={() => setFiltersOpen(false)} type="button"><X aria-hidden="true" size={20} /></button></header>{filterControls}<Button onClick={() => setFiltersOpen(false)}>Show requests</Button></section></div>}
  </main>
}
