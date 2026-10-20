import { CheckCircle, Circle, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import './ProfileCompleteness.css'

const checks = [
  { key: 'photo', label: 'Add a profile photo', hash: '#profile-photo', done: (provider, profile) => Boolean(provider?.avatar_path || profile?.avatar_path) },
  { key: 'name', label: 'Set your display name', hash: '#display-name', done: (provider) => Boolean(provider?.display_name?.trim()) },
  { key: 'about', label: 'Write about your work', hash: '#service-description', done: (provider) => (provider?.service_description?.trim().length || 0) >= 40 },
  { key: 'services', label: 'Choose a service', hash: '#provider-services', done: (provider) => Boolean(provider?.provider_service_categories?.length) },
  { key: 'areas', label: 'Add a service area', hash: '#provider-areas', done: (provider) => Boolean(provider?.is_nationwide || provider?.provider_service_areas?.length) },
  { key: 'availability', label: 'Set your availability', hash: '#provider-availability', done: (provider) => Boolean(provider?.availability) },
]

export default function ProfileCompleteness({ profile, provider, userId }) {
  const dismissalKey = userId ? `fixora-profile-completeness-dismissed:${userId}` : null
  const [dismissed, setDismissed] = useState(() => {
    try { return dismissalKey ? localStorage.getItem(dismissalKey) === 'true' : false } catch { return false }
  })
  const items = checks.map((check) => ({ ...check, complete: check.done(provider, profile) }))
  const completed = items.filter((item) => item.complete).length
  const percent = Math.round(completed / items.length * 100)
  if (percent === 100 || dismissed) return null
  function dismiss() {
    try { if (dismissalKey) localStorage.setItem(dismissalKey, 'true') } catch { /* Dismissal still applies for this render. */ }
    setDismissed(true)
  }
  return <section aria-label={`Profile ${percent}% complete`} className="profile-completeness">
    <button aria-label="Dismiss profile completion card" className="profile-completeness__dismiss" onClick={dismiss} type="button"><X aria-hidden="true" size={18} /></button>
    <div className="profile-completeness__top"><div className="profile-completeness__ring" style={{ '--progress': `${percent}%` }}><span>{percent}%</span></div><div><h2>Complete your profile</h2><p>A few details help customers choose you with confidence.</p></div></div>
    <ul>{items.map((item) => <li key={item.key}>{item.complete ? <CheckCircle aria-hidden="true" weight="fill" /> : <Circle aria-hidden="true" />}<Link aria-current={item.complete ? undefined : 'step'} className={item.complete ? 'is-complete' : ''} to={`/app/profile/edit${item.hash}`}>{item.label}</Link></li>)}</ul>
  </section>
}
