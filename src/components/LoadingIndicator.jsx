import { CircleNotch } from '@phosphor-icons/react'
import './LoadingIndicator.css'

export default function LoadingIndicator({ className = '', size = 18 }) {
  return <CircleNotch aria-hidden="true" className={`fixora-spinner${className ? ` ${className}` : ''}`} size={size} weight="bold" />
}
