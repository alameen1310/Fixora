import { useEffect, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { fetchLatestMyPosts } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'

export default function MarketplaceRail({ userId }) {
  const [posts, setPosts] = useState([])
  const [categories, setCategories] = useState([])
  useEffect(() => {
    let active = true
    Promise.all([
      fetchLatestMyPosts(userId, 3).catch(() => []),
      supabase.from('service_categories').select('name, slug').order('name').then(({ data }) => data ?? []).catch(() => []),
    ]).then(([nextPosts, nextCategories]) => {
      if (active) { setPosts(nextPosts); setCategories(nextCategories) }
    })
    return () => { active = false }
  }, [userId])

  return <aside aria-label="Marketplace shortcuts" className="marketplace-rail">
    <section className="marketplace-rail__card">
      <div className="marketplace-rail__heading"><h2>Your posts</h2><Link to="/app/my-posts">All</Link></div>
      {posts.length ? posts.map((post) => <Link className="marketplace-rail__post" key={post.id} to={`/app/posts/${post.id}`}><span>{post.title}</span><small>{post.status === 'closed' ? 'Closed' : 'Open'}</small></Link>) : <p className="marketplace-rail__empty">Your posts will appear here.</p>}
    </section>
    <section className="marketplace-rail__card"><h2>Browse by service</h2><div className="marketplace-rail__categories">{categories.map((category) => <Link key={category.slug} to={`/app/discover?category=${encodeURIComponent(category.slug)}`}>{category.name}<ArrowRight aria-hidden="true" size={15} /></Link>)}</div></section>
    <Link className="marketplace-rail__discover" to="/app/discover"><strong>Find professionals</strong><span>Browse local services and profiles.</span><ArrowRight aria-hidden="true" size={18} /></Link>
  </aside>
}
