import { useState } from 'react'
import { Briefcase, Drop, Hammer, Lightning, PaintBrush, Wrench } from '@phosphor-icons/react'
import { getPostImageUrl } from '../lib/postImages.js'
import './PostThumb.css'

const tints = ['#eaf0ff', '#e5f4f5', '#f1eafa', '#fff3dc', '#e8f4ec', '#faeaf0']
const icons = { plumbing: Drop, electrical: Lightning, installations: Hammer, renovation: PaintBrush, repairs: Wrench, maintenance: Wrench }

export default function PostThumb({ category, className = '', path, src, alt = '', loading = 'lazy' }) {
  const [broken, setBroken] = useState(false)
  const key = String(category?.slug || category?.name || '').toLowerCase().replace(/[^a-z]/g, '')
  const Icon = icons[key] || Briefcase
  const image = src || getPostImageUrl(path)
  return <span aria-label={alt || (image && !broken ? 'Request photo' : `${category?.name || 'Request'} category icon`)} className={`post-thumb${image && !broken ? ' has-image' : ''} ${className}`} role="img" style={{ '--post-thumb-tint': tints[key.length % tints.length] }}>
    {image && !broken ? <img alt="" loading={loading} onError={() => setBroken(true)} src={image} /> : <Icon aria-hidden="true" size={27} weight="duotone" />}
  </span>
}
