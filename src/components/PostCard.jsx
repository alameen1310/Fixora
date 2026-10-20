import { Briefcase, CalendarBlank, CaretRight, Drop, Hammer, Lightning, MapPin, PaintBrush, Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Skeleton } from './UiPrimitives.jsx'
import { formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { useState } from 'react'
import './Posts.css'

const categoryColors = ['#eaf0ff', '#e5f4f5', '#f1eafa', '#fff3dc', '#e8f4ec', '#faeaf0']
const categoryIcons = { plumbing: Drop, electrical: Lightning, installations: Hammer, renovation: PaintBrush, repairs: Wrench, maintenance: Wrench }

function postTiming(post) {
  if (post.timing === 'specific_date' && post.target_date) {
    return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(`${post.target_date}T00:00:00`))
  }
  return post.timing.replaceAll('_', ' ')
}

export function PostCardSkeleton() {
  return (
    <article aria-hidden="true" className="post-card post-card--skeleton">
      <Skeleton className="post-card__cover" />
      <div className="post-card__body">
        <Skeleton className="post-skeleton-line post-skeleton-line--short" />
        <Skeleton className="post-skeleton-line" />
        <Skeleton className="post-skeleton-line post-skeleton-line--medium" />
        <Skeleton className="post-skeleton-line post-skeleton-line--short" />
      </div>
    </article>
  )
}

export default function PostCard({ authorName, coverUrl = '', onCoverError, post, priority = false, showOwnerBadge = false }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageRetryAttempted, setImageRetryAttempted] = useState(false)
  const [hideImage, setHideImage] = useState(false)
  const category = post.service_categories
  const categoryKey = (category?.slug || '').toLowerCase().replace(/[^a-z]/g, '')
  const Icon = categoryIcons[categoryKey] || Briefcase
  const location = [post.city, post.region].filter(Boolean).join(', ')

  return (
    <Link aria-label={`Open post: ${post.title}`} className="post-card" to={`/app/posts/${post.id}`}>
      <div className={`post-card__cover${imageLoaded ? ' is-loaded' : ''}`}>
        {coverUrl && !hideImage ? (
          <img
            alt={`${post.title} cover`}
            fetchPriority={priority ? 'high' : 'auto'}
            loading={priority ? 'eager' : 'lazy'}
            onError={() => {
              if (imageRetryAttempted) setHideImage(true)
              else {
                setImageRetryAttempted(true)
                onCoverError?.()
              }
            }}
            onLoad={() => setImageLoaded(true)}
            src={coverUrl}
          />
        ) : (
          <div className="post-card__cover-placeholder" style={{ '--post-tint': categoryColors[categoryKey.length % categoryColors.length] }}>
            <Icon aria-hidden="true" size={30} weight="duotone" />
          </div>
        )}
        {showOwnerBadge && <Badge tone={post.status === 'completed' || post.hired_at ? 'success' : post.status === 'closed' ? 'neutral' : 'success'}>{post.status === 'completed' ? 'Completed' : post.hired_at ? 'Hired' : post.status === 'closed' ? 'Closed' : 'Open'}</Badge>}
      </div>
      <div className="post-card__body">
        {category?.name && <span className="post-card__category">{category.name}</span>}
        <h2 className="post-card__title">{post.title}</h2>
        <p className="post-card__description">{post.description}</p>
        <p className="post-card__budget">{formatPostBudget(post)}</p>
        <div className="post-card__meta">
          {location && <span><MapPin aria-hidden="true" size={15} />{location}</span>}
          <span><CalendarBlank aria-hidden="true" size={15} />{postTiming(post)}</span>
        </div>
        <div className="post-card__byline">
          <span className="post-card__author">
            <Avatar name={authorName || 'Fixora member'} size={28} />
            <span>{authorName || 'Fixora member'}</span>
          </span>
          <span className="post-card__time">{formatRelativeTime(post.created_at)}</span>
          <CaretRight aria-hidden="true" className="post-card__chevron" size={16} />
        </div>
      </div>
    </Link>
  )
}
