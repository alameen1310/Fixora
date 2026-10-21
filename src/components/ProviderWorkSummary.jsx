import { useEffect, useState } from 'react'
import { Star } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import BeforeAfterCard from './BeforeAfterCard.jsx'
import { Button } from './UiPrimitives.jsx'
import './ProviderWorkSummary.css'

function Stars({ rating }) {
  return <span aria-label={`${rating} out of 5 stars`} className="provider-review-stars">{[1, 2, 3, 4, 5].map((value) => <Star aria-hidden="true" key={value} size={15} weight={Number(rating) >= value - .5 ? 'fill' : 'regular'} />)}</span>
}

export default function ProviderWorkSummary({ avatarPath, displayName, profileId, onSummaryChange, showReputation = true }) {
  const [summary, setSummary] = useState(null)
  const [posts, setPosts] = useState([])
  const [reviews, setReviews] = useState([])
  const [jobs, setJobs] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setError(false)
      setLoading(true)
      try {
        const [ratingResult, workResult, reviewResult] = await Promise.all([
          supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').eq('provider_id', profileId).maybeSingle(),
          supabase.from('problem_posts').select('id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, status, created_at, completed_at, final_price_naira, hired_professional_id, service_categories(name, slug), problem_post_images(storage_path, sort_order, kind)', { count: 'exact' }).eq('hired_professional_id', profileId).eq('status', 'completed').order('completed_at', { ascending: false }),
          supabase.from('job_reviews').select('id, post_id, provider_id, customer_id, rating, comment, customer_display_name, created_at, problem_posts(title)').eq('provider_id', profileId).order('created_at', { ascending: false }).limit(20),
        ])
        if (ratingResult.error) throw ratingResult.error
        if (workResult.error) throw workResult.error
        if (reviewResult.error) throw reviewResult.error
        if (!active) return
        setSummary(ratingResult.data)
        setJobs(workResult.count ?? 0)
        const completedPosts = workResult.data ?? []
        setPosts(completedPosts.slice(0, 12).map((post) => ({ ...post, images: post.problem_post_images ?? [], provider: { display_name: displayName, avatar_path: avatarPath }, rating: ratingResult.data })))
        setReviews(reviewResult.data ?? [])
        onSummaryChange?.({ summary: ratingResult.data, jobs: workResult.count ?? 0, earned: completedPosts.reduce((sum, post) => sum + Number(post.final_price_naira || 0), 0) })
      } catch {
        if (active) setError(true)
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [avatarPath, displayName, onSummaryChange, profileId, retry])

  if (error) return <section className="provider-work-summary" role="alert"><p>Ratings and completed work couldn’t load.</p><Button onClick={() => setRetry((value) => value + 1)} variant="secondary">Try again</Button></section>
  if (loading) return <section aria-busy="true" className="provider-work-summary"><div className="provider-reputation-skeleton" /><div className="provider-work-summary__skeleton" /><div className="provider-work-summary__skeleton" /></section>

  const reviewCount = Number(summary?.review_count || 0)
  const average = Number(summary?.average_rating || 0)
  return <section className="provider-work-summary">
    {showReputation && <div className="provider-reputation"><div><span>Overall rating</span>{reviewCount ? <><strong>{average.toFixed(1)}</strong><Stars rating={average} /><p>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</p></> : <><strong className="provider-reputation__new">–</strong><p>No reviews yet</p></>}</div><div><span>Jobs completed</span><strong>{jobs}</strong></div></div>}
    <section className="provider-work-summary__section" id="completed-work"><h2>Completed work</h2>{posts.length ? <div className="provider-work-grid">{posts.map((post) => <BeforeAfterCard key={post.id} post={{ ...post, provider: { display_name: displayName }, rating: summary }} />)}</div> : <p className="provider-work-summary__empty">Finished jobs appear here as before-and-after posts.</p>}</section>
    <section className="provider-work-summary__section" id="reviews"><h2>Reviews</h2>{reviews.length ? <div className="provider-review-list">{reviews.map((review) => <article className="provider-review" key={review.id}><div className="provider-review__head"><strong>{review.customer_display_name}</strong><Stars rating={review.rating} /><time>{new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(review.created_at))}</time></div>{review.comment && <p>{review.comment}</p>}<span>{review.problem_posts?.title || 'Completed project'}</span></article>)}</div> : <p className="provider-work-summary__empty">No reviews yet.</p>}</section>
  </section>
}
