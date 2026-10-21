import { Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar } from './UiPrimitives.jsx'
import BeforeAfterSlider from './BeforeAfterSlider.jsx'
import { avatarUrl } from '../lib/avatarImages.js'
import { formatRelativeTime } from '../lib/postQueries.js'
import './BeforeAfterCard.css'

const naira = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)

export default function BeforeAfterCard({ post }) {
  const images = post.images ?? post.problem_post_images ?? []
  const beforeImages = images.filter((image) => image.kind === 'before').sort((a, b) => a.sort_order - b.sort_order)
  const afterImages = images.filter((image) => image.kind === 'after').sort((a, b) => a.sort_order - b.sort_order)
  const rating = Number(post.rating?.average_rating)
  const count = Number(post.rating?.review_count || 0)
  return <article className="before-after-card">
    <BeforeAfterSlider after={afterImages} before={beforeImages} compact title={post.title} />
    <div className="before-after-card__body"><h2><Link aria-label={`View completed project: ${post.title}`} to={`/app/posts/${post.id}`}>{post.title}</Link></h2><div className="before-after-card__provider"><Avatar name={post.provider?.display_name || 'Professional'} size={28} src={avatarUrl(post.provider?.avatar_path)} /><span>{post.provider?.display_name || 'Fixora professional'}</span>{count > 0 && <span className="before-after-card__rating"><Star aria-hidden="true" size={14} weight="fill" />{rating.toFixed(1)} ({count})</span>}</div><div className="before-after-card__meta"><strong>{post.final_price_naira ? `Paid ${naira(post.final_price_naira)}` : 'Completed'}</strong><time>{formatRelativeTime(post.completed_at || post.created_at)}</time></div></div>
  </article>
}
