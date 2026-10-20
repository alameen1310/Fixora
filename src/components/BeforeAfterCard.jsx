import { Star } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar } from './UiPrimitives.jsx'
import { avatarUrl } from '../lib/avatarImages.js'
import { getPostImageUrl } from '../lib/postImages.js'
import { formatRelativeTime } from '../lib/postQueries.js'
import './BeforeAfterCard.css'

const naira = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)

export default function BeforeAfterCard({ post }) {
  const images = post.images ?? post.problem_post_images ?? []
  const before = images.filter((image) => image.kind === 'before').sort((a, b) => a.sort_order - b.sort_order)[0]
  const after = images.filter((image) => image.kind === 'after').sort((a, b) => a.sort_order - b.sort_order)[0]
  const rating = Number(post.rating?.average_rating)
  const count = Number(post.rating?.review_count || 0)
  return <Link aria-label={`View completed project: ${post.title}`} className="before-after-card" to={`/app/posts/${post.id}`}>
    <div className="before-after-card__images">{[[before, 'Before'], [after, 'After']].map(([image, label]) => <div className="before-after-card__image" key={label}>{image ? <img alt={`${post.title}, ${label.toLowerCase()}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} src={getPostImageUrl(image.storage_path)} /> : <span>No photo</span>}<small>{label}</small></div>)}</div>
    <div className="before-after-card__body"><h2>{post.title}</h2><div className="before-after-card__provider"><Avatar name={post.provider?.display_name || 'Professional'} size={28} src={avatarUrl(post.provider?.avatar_path)} /><span>{post.provider?.display_name || 'Fixora professional'}</span>{count > 0 && <span className="before-after-card__rating"><Star aria-hidden="true" size={14} weight="fill" />{rating.toFixed(1)} ({count})</span>}</div><div className="before-after-card__meta"><strong>{post.final_price_naira ? `Paid ${naira(post.final_price_naira)}` : 'Completed'}</strong><time>{formatRelativeTime(post.completed_at || post.created_at)}</time></div></div>
  </Link>
}
