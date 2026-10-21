import { ArrowLeft, ArrowRight, Briefcase, CalendarBlank, CaretRight, Drop, Hammer, Lightning, MapPin, PaintBrush, Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Skeleton } from './UiPrimitives.jsx'
import { formatPostBudget, formatRelativeTime } from '../lib/postQueries.js'
import { avatarUrl } from '../lib/avatarImages.js'
import { useMemo, useState } from 'react'
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

export default function PostCard({ authorName, authorAvatarPath, coverUrl = '', photoUrls = {}, post, priority = false, showOwnerBadge = false }) {
  const [activePhoto, setActivePhoto] = useState(0)
  const [loadedPhotos, setLoadedPhotos] = useState(() => new Set())
  const [hiddenPhotos, setHiddenPhotos] = useState(() => new Set())
  const photos = useMemo(() => [...(post.problem_post_images ?? [])]
    .filter((image) => image.kind === 'before')
    .sort((first, second) => first.sort_order - second.sort_order), [post.problem_post_images])
  const photoCount = photos.length
  const currentPhoto = photos[activePhoto]
  const currentPhotoUrl = currentPhoto ? photoUrls[currentPhoto.storage_path] || (activePhoto === 0 ? coverUrl : '') : coverUrl
  const category = post.service_categories
  const categoryKey = (category?.slug || '').toLowerCase().replace(/[^a-z]/g, '')
  const Icon = categoryIcons[categoryKey] || Briefcase
  const location = [post.city, post.region].filter(Boolean).join(', ')

  return (
    <article className="post-card">
      <div className={`post-card__cover${loadedPhotos.has(currentPhoto?.storage_path) ? ' is-loaded' : ''}`}>
        <Link aria-label={`Open post: ${post.title}`} className="post-card__cover-link" tabIndex={-1} to={`/app/posts/${post.id}`}>
        {currentPhotoUrl && !hiddenPhotos.has(currentPhoto?.storage_path) ? (
          <img
            alt={`${post.title} cover`}
            fetchPriority={priority ? 'high' : 'auto'}
            loading={priority ? 'eager' : 'lazy'}
            onError={() => setHiddenPhotos((current) => new Set(current).add(currentPhoto?.storage_path))}
            onLoad={() => setLoadedPhotos((current) => new Set(current).add(currentPhoto?.storage_path))}
            src={currentPhotoUrl}
          />
        ) : (
          <div className="post-card__cover-placeholder" style={{ '--post-tint': categoryColors[categoryKey.length % categoryColors.length] }}>
            <Icon aria-hidden="true" size={30} weight="duotone" />
          </div>
        )}
        </Link>
        {photoCount > 1 && (
          <>
            <button aria-label="Previous photo" className="post-card__photo-arrow post-card__photo-arrow--previous" disabled={activePhoto === 0} onClick={() => setActivePhoto((index) => Math.max(0, index - 1))} type="button">
              <ArrowLeft aria-hidden="true" size={18} weight="bold" />
            </button>
            <button aria-label="Next photo" className="post-card__photo-arrow post-card__photo-arrow--next" disabled={activePhoto === photoCount - 1} onClick={() => setActivePhoto((index) => Math.min(photoCount - 1, index + 1))} type="button">
              <ArrowRight aria-hidden="true" size={18} weight="bold" />
            </button>
          </>
        )}
        {photoCount > 0 && <span aria-label={photoCount === 1 ? '1 photo' : `Photo ${activePhoto + 1} of ${photoCount}`} aria-live="polite" className="post-card__photo-count">{photoCount === 1 ? '1 photo' : `${activePhoto + 1} / ${photoCount}`}</span>}
        {showOwnerBadge && <Badge tone={post.status === 'completed' || post.hired_at ? 'success' : post.status === 'closed' ? 'neutral' : 'success'}>{post.status === 'completed' ? 'Completed' : post.hired_at ? 'Hired' : post.status === 'closed' ? 'Closed' : 'Open'}</Badge>}
      </div>
      <Link aria-label={`Open post: ${post.title}`} className="post-card__body-link" to={`/app/posts/${post.id}`}>
      <div className="post-card__body">
        {category?.name && <span className="post-card__category">{category.name}</span>}
        <h2 className="post-card__title">{post.title}</h2>
        <p className="post-card__description">{post.description}</p>
        <p className="post-card__budget">{formatPostBudget(post)}</p>
        <div className="post-card__meta">
          {location && <span><MapPin aria-hidden="true" size={15} />{location}</span>}
          <span><CalendarBlank aria-hidden="true" size={15} />{postTiming(post)}</span>
          {post.schedule_mode === 'confirmed' && <span><CalendarBlank aria-hidden="true" size={15} />Scheduled</span>}
        </div>
        <div className="post-card__byline">
          <span className="post-card__author">
            <Avatar name={authorName || 'Fixora member'} size={28} src={avatarUrl(authorAvatarPath)} />
            <span>{authorName || 'Fixora member'}</span>
          </span>
          <span className="post-card__time">{formatRelativeTime(post.created_at)}</span>
          <CaretRight aria-hidden="true" className="post-card__chevron" size={16} />
        </div>
      </div>
      </Link>
    </article>
  )
}
