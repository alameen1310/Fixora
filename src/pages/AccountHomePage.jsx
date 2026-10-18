import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Wrench } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import PublishedProfessionals from '../components/PublishedProfessionals.jsx'
import './AuthenticatedPages.css'

export default function AccountHomePage() {
  const { profile } = useAuth()
  const isProvider = profile?.account_type === 'provider'
  const firstName = profile?.full_name?.trim().split(/\s+/)[0]

  return (
    <main className="app-page app-home">
      <section className="app-home__welcome">
        <div>
          <p className="app-eyebrow">{isProvider ? 'Your professional home' : 'A better path to the right help'}</p>
          <h1>{firstName ? 'Good to see you, ' + firstName + '.' : 'Welcome to Fixora.'}</h1>
          <p>{isProvider
            ? 'Build your presence, discover what Fixora can do today, and get ready for new opportunities.'
            : 'Discover skilled household professionals through the services and profiles they share.'}</p>
        </div>
        {isProvider ? (
          <Link className="app-primary-action" to="/app/discover?kind=problems"><Wrench aria-hidden="true" size={20} /> Find jobs <ArrowRight aria-hidden="true" size={18} /></Link>
        ) : (
          <div className="app-primary-action-wrap">
            <button className="app-primary-action is-unavailable" disabled type="button"><Plus aria-hidden="true" size={21} /> Post a problem</button>
            <p>Problem posting is not available yet. You can still explore the professional community.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="home-feed-title" className="app-section">
        <div className="app-section__heading">
          <div><p className="app-eyebrow">Discover</p><h2 id="home-feed-title">Professionals in the community</h2></div>
          <Link className="app-text-link" to="/app/discover">Explore all <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
        <p className="app-section__intro">Published Fixora profiles, with service details and areas shared by the professionals themselves.</p>
        <PublishedProfessionals limit={4} />
      </section>

      <section className="app-home__note">
        <div><p className="app-eyebrow">What’s next for Fixora</p><h2>Real projects and job tools are on the way.</h2><p>Request posting, applications, active jobs, completed project stories, and reviews need marketplace workflows that are not available yet.</p></div>
        <Link className="app-secondary-action" to="/app/activity">View activity <ArrowRight aria-hidden="true" size={17} /></Link>
      </section>
    </main>
  )
}
