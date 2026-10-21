import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowClockwise, ClipboardText } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from './UiPrimitives.jsx'
import PostCard, { PostCardSkeleton } from './PostCard.jsx'
import { fetchAuthorCards, fetchLatestOwnPost, fetchOtherOpenPosts, fetchMyPosts, postCursor } from '../lib/postQueries.js'
import { getPostImageUrl } from '../lib/postImages.js'
import { homeFeedCache, myPostsCache } from '../lib/postListCache.js'

const PAGE_SIZE = 10
export function PostsFeed({ userId, showOwnLatest = false, categorySlug = '' }) {
  const cacheKey = `${userId}:${categorySlug || 'all'}`
  const saved = homeFeedCache.get(cacheKey)
  const [posts, setPosts] = useState(() => saved?.posts ?? [])
  const [ownLatest, setOwnLatest] = useState(() => saved?.ownLatest ?? null)
  const [pendingOwnLatest, setPendingOwnLatest] = useState(() => saved?.pendingOwnLatest ?? null)
  const [authors, setAuthors] = useState(() => saved?.authors ?? {})
  const [authorAvatars, setAuthorAvatars] = useState(() => saved?.authorAvatars ?? {})
  const [covers, setCovers] = useState(() => saved?.covers ?? {})
  const [loading, setLoading] = useState(() => !saved?.lastRefreshAt)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [retryNextPage, setRetryNextPage] = useState(false)
  const [hasMore, setHasMore] = useState(() => saved?.hasMore ?? true)
  const [newPosts, setNewPosts] = useState(() => saved?.newPosts ?? [])
  const cursor = useRef(saved?.cursor ?? null)
  const sentinel = useRef(null)
  const lastRefreshAt = useRef(saved?.lastRefreshAt ?? 0)
  const postsRef = useRef(posts)
  const ownLatestRef = useRef(ownLatest)
  const pendingOwnLatestRef = useRef(pendingOwnLatest)
  const newPostsRef = useRef(newPosts)
  postsRef.current = posts
  ownLatestRef.current = ownLatest
  pendingOwnLatestRef.current = pendingOwnLatest
  newPostsRef.current = newPosts
  const busy = useRef(false)

  const attachAssets = useCallback(async (items) => {
    if (!items.length) return
    const cards = await fetchAuthorCards(items)
    setAuthors((current) => ({ ...current, ...Object.fromEntries(cards.map((card) => [card.post_id, card.display_name])) }))
    setAuthorAvatars((current) => ({ ...current, ...Object.fromEntries(cards.map((card) => [card.post_id, card.avatar_path])) }))
      const imagePaths = items.flatMap(({ problem_post_images = [] }) => problem_post_images.map(({ storage_path }) => storage_path).filter(Boolean))
      setCovers((current) => ({ ...current, ...Object.fromEntries(imagePaths.map((path) => [path, getPostImageUrl(path)])) }))
  }, [])

  const loadFirstPage = useCallback(async ({ silent = false } = {}) => {
    if (busy.current) return
    busy.current = true
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const [firstPage, latest] = await Promise.all([
        fetchOtherOpenPosts(userId, { limit: PAGE_SIZE, categorySlug }),
        showOwnLatest ? fetchLatestOwnPost(userId) : Promise.resolve(null),
      ])
      await attachAssets([...firstPage, ...(latest ? [latest] : [])])
      if (silent) {
        const known = new Set(postsRef.current.map(({ id }) => id))
        const incoming = firstPage.filter(({ id }) => !known.has(id))
        setNewPosts(incoming)
        if (latest?.id !== ownLatestRef.current?.id) setPendingOwnLatest(latest)
      } else {
        setPosts(firstPage)
        setOwnLatest(latest)
        cursor.current = postCursor(firstPage.at(-1))
        setHasMore(firstPage.length === PAGE_SIZE)
      }
      lastRefreshAt.current = Date.now()
      setError('')
      setRetryNextPage(false)
    } catch {
      setError('We couldn’t load open posts. Check your connection and try again.')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [attachAssets, categorySlug, showOwnLatest, userId])

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore || !cursor.current) return
    busy.current = true
    setLoadingMore(true)
    try {
      const page = await fetchOtherOpenPosts(userId, { cursor: cursor.current, limit: PAGE_SIZE, categorySlug })
      await attachAssets(page)
      setPosts((current) => {
        const known = new Set(current.map(({ id }) => id))
        return [...current, ...page.filter(({ id }) => !known.has(id))]
      })
      cursor.current = postCursor(page.at(-1)) || cursor.current
      setHasMore(page.length === PAGE_SIZE)
      setError('')
      setRetryNextPage(false)
    } catch {
      setError('We couldn’t load more posts. Try again.')
      setRetryNextPage(true)
    } finally {
      busy.current = false
      setLoadingMore(false)
    }
  }, [attachAssets, categorySlug, hasMore, userId])

  const refreshNew = useCallback(() => {
    if (newPostsRef.current.length) {
      setPosts((current) => {
        const known = new Set(current.map(({ id }) => id))
        return [...newPostsRef.current.filter(({ id }) => !known.has(id)), ...current]
      })
      setNewPosts([])
    }
    if (pendingOwnLatestRef.current) {
      setOwnLatest(pendingOwnLatestRef.current)
      setPendingOwnLatest(null)
    }
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [])

  useEffect(() => {
    if (saved?.lastRefreshAt) {
      if (Date.now() - saved.lastRefreshAt > 60_000) void loadFirstPage({ silent: true })
    } else void loadFirstPage()
  }, [loadFirstPage, saved?.lastRefreshAt, userId, showOwnLatest])

  useEffect(() => {
    homeFeedCache.set(cacheKey, {
      posts, ownLatest, pendingOwnLatest, authors, authorAvatars, covers, hasMore, newPosts,
      cursor: cursor.current, lastRefreshAt: lastRefreshAt.current,
    })
  }, [cacheKey, posts, ownLatest, pendingOwnLatest, authors, authorAvatars, covers, hasMore, newPosts])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefreshAt.current >= 60_000) void loadFirstPage({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    const onHomeRefresh = () => {
      if (window.scrollY <= 8) void loadFirstPage({ silent: true })
    }
    window.addEventListener('fixora:home-refresh', onHomeRefresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('fixora:home-refresh', onHomeRefresh)
    }
  }, [loadFirstPage])

  useEffect(() => {
    if (loading || loadingMore || !hasMore || !sentinel.current || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadMore()
    }, { rootMargin: '500px 0px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loading, loadingMore])

  const visiblePosts = useMemo(() => posts, [posts])
  const empty = !loading && !error && !ownLatest && visiblePosts.length === 0
  const noOtherPosts = !loading && !error && visiblePosts.length === 0
  if (loading) return <div aria-label="Loading posts" className="posts-grid" role="status"><PostCardSkeleton /><PostCardSkeleton /><PostCardSkeleton /></div>

  return (
    <div className="posts-feed">
      {(newPosts.length > 0 || pendingOwnLatest) && (
        <button className="posts-new-pill" onClick={refreshNew} type="button">
          <ArrowClockwise aria-hidden="true" size={16} />New posts
        </button>
      )}
      {showOwnLatest && ownLatest && (
        <section aria-label="Your latest post" className="posts-own-latest">
          <p className="posts-feed__label">Your latest post</p>
          <PostCard authorName={authors[ownLatest.id]} authorAvatarPath={authorAvatars[ownLatest.id]} coverUrl={covers[ownLatest.coverPath]} photoUrls={covers} post={ownLatest} priority showOwnerBadge />
        </section>
      )}
      {!empty && visiblePosts.length > 0 && (
        <div className="posts-grid">
          {visiblePosts.map((post, index) => (
            <PostCard authorName={authors[post.id]} authorAvatarPath={authorAvatars[post.id]} coverUrl={covers[post.coverPath]} photoUrls={covers} key={post.id} post={post} priority={index === 0 && !ownLatest} />
          ))}
        </div>
      )}
      {empty && (
        <EmptyState
          icon={ClipboardText}
          message="Open requests from customers will show up here."
          title="No open posts yet"
          action={<div className="posts-empty-actions">{showOwnLatest && <Button as={Link} to="/app/posts/new">Post a problem</Button>}<Button onClick={() => void loadFirstPage()} variant="secondary">Retry</Button><Button as={Link} to="/app/discover" variant="secondary">Discover professionals</Button></div>}
        />
      )}
      {noOtherPosts && ownLatest && (
        <section className="posts-no-others"><strong>No open posts yet</strong><span>New requests from other customers will appear here.</span></section>
      )}
      {error && (
        <section aria-live="polite" className="posts-feed__error" role="alert">
          <p>{error}</p>
          <Button onClick={() => retryNextPage ? void loadMore() : void loadFirstPage({ silent: posts.length > 0 })} variant="secondary">Retry</Button>
        </section>
      )}
      {!error && hasMore && posts.length > 0 && (
        <div className="posts-feed__more" ref={sentinel}>
          <Button loading={loadingMore} onClick={loadMore} variant="secondary">Load more</Button>
        </div>
      )}
    </div>
  )
}

export function MyPostsList({ userId }) {
  const saved = myPostsCache.get(userId)
  const [posts, setPosts] = useState(() => saved?.posts ?? [])
  const [authors, setAuthors] = useState(() => saved?.authors ?? {})
  const [authorAvatars, setAuthorAvatars] = useState(() => saved?.authorAvatars ?? {})
  const [covers, setCovers] = useState(() => saved?.covers ?? {})
  const [loading, setLoading] = useState(() => !saved)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(() => saved?.hasMore ?? true)
  const cursor = useRef(saved?.cursor ?? null)
  const lastRefreshAt = useRef(saved?.lastRefreshAt ?? 0)

  const loadPage = useCallback(async (append = false, { silent = false } = {}) => {
    if (append) setLoadingMore(true)
    else if (!silent) { setLoading(true); setError('') }
    try {
      const page = await fetchMyPosts(userId, { cursor: append ? cursor.current : null, limit: PAGE_SIZE })
      const cards = await fetchAuthorCards(page)
      setAuthors((current) => ({ ...current, ...Object.fromEntries(cards.map((card) => [card.post_id, card.display_name])) }))
      setAuthorAvatars((current) => ({ ...current, ...Object.fromEntries(cards.map((card) => [card.post_id, card.avatar_path])) }))
      const imagePaths = page.flatMap(({ problem_post_images = [] }) => problem_post_images.map(({ storage_path }) => storage_path).filter(Boolean))
      setCovers((current) => ({ ...current, ...Object.fromEntries(imagePaths.map((path) => [path, getPostImageUrl(path)])) }))
      setPosts((current) => append ? [...current, ...page] : page)
      cursor.current = postCursor(page.at(-1))
      setHasMore(page.length === PAGE_SIZE)
      lastRefreshAt.current = Date.now()
      setError('')
    } catch {
      setError('We couldn’t load your posts. Check your connection and try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [userId])

  useEffect(() => {
    const cached = myPostsCache.get(userId)
    if (!cached) void loadPage()
    else if (Date.now() - lastRefreshAt.current >= 60_000) void loadPage(false, { silent: true })
  }, [loadPage, userId])
  useEffect(() => {
    const refresh = () => { void loadPage(false, { silent: true }) }
    window.addEventListener('fixora:my-posts-refresh', refresh)
    return () => window.removeEventListener('fixora:my-posts-refresh', refresh)
  }, [loadPage])
  useEffect(() => {
    myPostsCache.set(userId, { posts, authors, authorAvatars, covers, hasMore, cursor: cursor.current, lastRefreshAt: lastRefreshAt.current })
  }, [userId, posts, authors, authorAvatars, covers, hasMore])

  if (loading) return <div aria-label="Loading your posts" className="posts-grid" role="status"><PostCardSkeleton /><PostCardSkeleton /><PostCardSkeleton /></div>
  if (error && posts.length === 0) return <section className="posts-feed__error" role="alert"><p>{error}</p><Button onClick={() => void loadPage()} variant="secondary">Retry</Button></section>
  if (posts.length === 0) {
    return <EmptyState icon={ClipboardText} message="Posts you publish will be listed here." title="No posts yet" />
  }
  return (
    <>
      {error && <section className="posts-feed__error" role="alert"><p>{error}</p><Button onClick={() => void loadPage(true)} variant="secondary">Retry</Button></section>}
      <div className="posts-grid">
        {posts.map((post, index) => (
          <PostCard authorName={authors[post.id]} authorAvatarPath={authorAvatars[post.id]} coverUrl={covers[post.coverPath]} photoUrls={covers} key={post.id} post={post} priority={index === 0} showOwnerBadge />
        ))}
      </div>
      {hasMore && <div className="posts-feed__more"><Button loading={loadingMore} onClick={() => void loadPage(true)} variant="secondary">Load more</Button></div>}
    </>
  )
}
