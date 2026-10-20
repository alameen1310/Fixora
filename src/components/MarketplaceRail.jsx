import { useEffect, useState } from 'react'
import { ArrowRight, Drop, GearSix, Hammer, Lightning, PaintBrush, Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Badge } from './UiPrimitives.jsx'
import { fetchLatestMyPosts } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'

const categoryVisuals = {
  electrical: { Icon: Lightning, tone: 'electrical' },
  installations: { Icon: Hammer, tone: 'installations' },
  maintenance: { Icon: GearSix, tone: 'maintenance' },
  plumbing: { Icon: Drop, tone: 'plumbing' },
  renovation: { Icon: PaintBrush, tone: 'renovation' },
  repairs: { Icon: Wrench, tone: 'repairs' },
}

function getCategoryVisual(category) {
  const key = `${category.slug ?? ''} ${category.name ?? ''}`.toLowerCase()
  const entry = Object.entries(categoryVisuals).find(([service]) => key.includes(service))?.[1]
  return entry ?? { Icon: Wrench, tone: 'default' }
}

export default function MarketplaceRail({ categories: suppliedCategories, userId, showServices = true }) {
  const [posts, setPosts] = useState([])
  const [loadedCategories, setLoadedCategories] = useState([])
  useEffect(() => {
    let active = true
    fetchLatestMyPosts(userId, 3).then((rows) => { if (active) setPosts(rows) }).catch(() => { if (active) setPosts([]) })
    return () => { active = false }
  }, [userId])
  useEffect(() => {
    if (!showServices || suppliedCategories) return undefined
    let active = true
    supabase.from('service_categories').select('name, slug').order('name').then(({ data }) => { if (active) setLoadedCategories(data ?? []) })
    return () => { active = false }
  }, [showServices, suppliedCategories])
  const categories = suppliedCategories ?? loadedCategories

  return <aside aria-label="Marketplace shortcuts" className="marketplace-rail">
    <section className="marketplace-rail__card">
      <div className="marketplace-rail__heading"><h2>Your posts</h2><Link to="/app/my-posts">All</Link></div>
      {posts.length ? posts.map((post) => {
        const label = post.status === 'completed' ? 'Completed' : post.hired_professional_id ? 'Hired' : post.status === 'open' ? 'Open' : post.status === 'removed' ? 'Removed' : 'Closed'
        const tone = post.status === 'completed' ? 'deep' : post.hired_professional_id ? 'success' : post.status === 'open' ? 'info' : 'neutral'
        return <Link className="marketplace-rail__post" key={post.id} to={`/app/posts/${post.id}`}><span>{post.title}</span><Badge tone={tone}>{label}</Badge></Link>
      }) : <p className="marketplace-rail__empty">Your posts will appear here.</p>}
    </section>
    {showServices && <section className="marketplace-rail__card"><h2>Browse by service</h2><div className="marketplace-rail__categories">{categories.map((category) => { const { Icon, tone } = getCategoryVisual(category); return <Link key={category.slug} to={`/app/discover?category=${encodeURIComponent(category.slug)}`}><span className={`marketplace-rail__category-icon marketplace-rail__category-icon--${tone}`}><Icon aria-hidden="true" size={16} weight="regular" /></span>{category.name}</Link> })}</div></section>}
    <div className="marketplace-rail__actions"><Link className="marketplace-rail__post-action" to="/app/posts/new">Post a problem <ArrowRight aria-hidden="true" size={16} /></Link><Link className="marketplace-rail__discover" to="/app/discover"><strong>Browse professionals</strong><span>Find local services and profiles.</span><ArrowRight aria-hidden="true" size={18} /></Link></div>
  </aside>
}
