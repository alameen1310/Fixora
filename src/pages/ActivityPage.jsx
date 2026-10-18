import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardText } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import './AuthenticatedPages.css'

export default function ActivityPage() {
  const { profile } = useAuth()
  const isProvider = profile?.account_type === 'provider'

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <p className="app-eyebrow">Your account</p>
        <h1>Activity</h1>
        <p>{isProvider ? 'Keep track of applications, accepted work, and completed jobs as those tools arrive.' : 'Keep track of your household requests, applicants, and active jobs as those tools arrive.'}</p>
      </header>
      <section className="app-unavailable-state">
        <span className="app-unavailable-state__icon"><ClipboardText aria-hidden="true" size={24} /></span>
        <p className="app-eyebrow">No activity yet</p>
        <h2>{isProvider ? 'Applications and jobs aren’t available yet.' : 'Requests and jobs aren’t available yet.'}</h2>
        <p>The current Fixora release does not include request, application, or job records. Nothing has been hidden or filled with sample activity.</p>
        <Link className="app-secondary-action" to="/app/discover">Explore Fixora <ArrowRight aria-hidden="true" size={17} /></Link>
      </section>
    </main>
  )
}
