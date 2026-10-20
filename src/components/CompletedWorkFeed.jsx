import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './UiPrimitives.jsx'
import BeforeAfterCard from './BeforeAfterCard.jsx'
import { completedPostCursor, fetchCompletedPosts } from '../lib/postQueries.js'

const PAGE_SIZE = 10

export default function CompletedWorkFeed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const cursor = useRef(null)

  const loadPage = useCallback(async (append = false) => {
    if (append) setLoadingMore(true)
    else { setLoading(true); setError('') }
    try {
      const rows = await fetchCompletedPosts({ cursor: append ? cursor.current : null, limit: PAGE_SIZE })
      setPosts((current) => append ? [...current, ...rows] : rows)
      cursor.current = completedPostCursor(rows.at(-1))
      setHasMore(rows.length === PAGE_SIZE)
      setError('')
    } catch {
      setError('Completed projects didn’t load. Check your connection and retry.')
    } finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { void loadPage() }, [loadPage])

  if (loading) return <div aria-label="Loading completed projects" className="completed-work-grid" role="status">{[0, 1, 2].map((item) => <div className="completed-work-skeleton" key={item} />)}</div>
  if (error && !posts.length) return <section className="posts-feed__error" role="alert"><p>{error}</p><Button onClick={() => void loadPage()} variant="secondary">Retry</Button></section>
  if (!posts.length) return <section className="completed-work-empty"><h3>Completed projects will show up here.</h3><p>Finished work shared by customers and professionals will appear in this feed.</p></section>
  return <div className="completed-work-feed">{error && <section className="posts-feed__error" role="alert"><p>{error}</p><Button onClick={() => void loadPage(true)} variant="secondary">Retry</Button></section>}<div className="completed-work-grid">{posts.map((post) => <BeforeAfterCard key={post.id} post={post} />)}</div>{hasMore && <div className="posts-feed__more"><Button loading={loadingMore} onClick={() => void loadPage(true)} variant="secondary">Load more</Button></div>}</div>
}
