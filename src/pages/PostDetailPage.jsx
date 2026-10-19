import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarBlank, MapPin, Wrench } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Skeleton } from '../components/UiPrimitives.jsx'
import { fetchProblemPost, formatPostBudget, formatRelativeTime, invalidateSignedPostImage, signPostImages } from '../lib/postQueries.js'
import { useAuth } from '../context/AuthContext.jsx'
import '../components/Posts.css'

export default function PostDetailPage() {
  const { postId } = useParams()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [imageUrls, setImageUrls] = useState({})
  const [activePhoto, setActivePhoto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const retriedImages = useRef(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const result = await fetchProblemPost(postId)
      if (!result || (result.author_id !== user?.id && (result.status !== 'open' || !result.published_at))) {
        setPost(null)
        return
      }
      setPost(result)
      const signed = await signPostImages(result.images.map(({ storage_path }) => storage_path))
      setImageUrls(signed)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [postId, user?.id])

  useEffect(() => { void load() }, [load])

  if (loading) return <main className="app-page post-detail"><Skeleton className="post-detail__hero-skeleton" /><Skeleton className="post-skeleton-line" /><Skeleton className="post-skeleton-line post-skeleton-line--medium" /></main>
  if (error) return <main className="app-page"><section className="posts-feed__error" role="alert"><h1>We couldn’t load this post</h1><p>Check your connection and try again.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></section></main>
  if (!post) return <main className="app-page"><section className="app-unavailable-state"><h1>Post not found</h1><p>This post may have been closed or removed.</p><Button as={Link} to="/app" variant="secondary">Back to posts</Button></section></main>

  const location = [post.city, post.region].filter(Boolean).join(', ')
  const timing = post.timing === 'specific_date' && post.target_date
    ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${post.target_date}T00:00:00`))
    : post.timing.replaceAll('_', ' ')

  async function retryImage(path) {
    if (retriedImages.current.has(path)) {
      setImageUrls((current) => { const next = { ...current }; delete next[path]; return next })
      return
    }
    retriedImages.current.add(path)
    invalidateSignedPostImage(path)
    try {
      const signed = await signPostImages([path], { refresh: true })
      setImageUrls((current) => {
        const next = { ...current }
        if (signed[path]) next[path] = signed[path]
        else delete next[path]
        return next
      })
    } catch {
      setImageUrls((current) => { const next = { ...current }; delete next[path]; return next })
    }
  }

  return (
    <main className="app-page post-detail">
      <Link className="app-back-link post-detail__back" to="/app"><ArrowLeft aria-hidden="true" size={19} />Back to posts</Link>
      {post.images.length > 0 && (
        <section aria-label="Post photos" className="post-gallery">
          <div className="post-gallery__track" onScroll={(event) => setActivePhoto(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}>
            {post.images.map((image, index) => imageUrls[image.storage_path] ? (
              <figure className="post-gallery__slide" key={image.storage_path}>
                <img alt={`${post.title}, photo ${index + 1}`} onError={() => void retryImage(image.storage_path)} src={imageUrls[image.storage_path]} />
              </figure>
            ) : null)}
          </div>
          <div aria-hidden="true" className="post-gallery__dots">
            {post.images.filter(({ storage_path }) => imageUrls[storage_path]).map((image, index) => <span className={index === activePhoto ? 'is-active' : ''} key={image.storage_path} />)}
          </div>
        </section>
      )}
      <article className="post-detail__content">
        <div className="post-detail__eyebrows">
          {post.service_categories?.name && <span className="post-card__category">{post.service_categories.name}</span>}
          {post.status !== 'open' && <Badge tone="neutral">{post.status === 'closed' ? 'Closed' : 'Removed'}</Badge>}
        </div>
        <h1>{post.title}</h1>
        <p className="post-detail__budget">{formatPostBudget(post)}{post.negotiable && post.budget_type === 'range' ? ' · Negotiable' : ''}</p>
        <div className="post-detail__meta">
          {location && <span><MapPin aria-hidden="true" size={18} />{location}</span>}
          <span><CalendarBlank aria-hidden="true" size={18} />{timing}</span>
          <span><Wrench aria-hidden="true" size={18} />{post.job_type.replaceAll('_', ' ')}</span>
        </div>
        <section className="post-detail__section">
          <h2>Details</h2>
          <p className="post-detail__description">{post.description}</p>
        </section>
        <section className="post-detail__author">
          <Avatar name={post.authorName || 'Fixora member'} size={44} />
          <div><span>Posted by</span><strong>{post.authorName || 'Fixora member'}</strong></div>
          <time>{formatRelativeTime(post.created_at)}</time>
        </section>
      </article>
    </main>
  )
}
