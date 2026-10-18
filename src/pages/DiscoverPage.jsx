import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Briefcase, House, Images, UsersThree } from '@phosphor-icons/react'
import PublishedProfessionals from '../components/PublishedProfessionals.jsx'
import './AuthenticatedPages.css'

const views = [
  { key: 'professionals', label: 'Professionals', icon: UsersThree },
  { key: 'problems', label: 'Open problems', icon: House },
  { key: 'projects', label: 'Completed projects', icon: Images },
]

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedKind = searchParams.get('kind')
  const selected = views.some(({ key }) => key === requestedKind) ? requestedKind : 'professionals'

  return (
    <main className="app-page">
      <header className="app-page__heading">
        <p className="app-eyebrow">Discover</p>
        <h1>Find the work and people that fit.</h1>
        <p>Explore public professional profiles today. Other discovery streams will appear when their marketplace data is available.</p>
      </header>

      <nav aria-label="Discovery type" className="app-filter-tabs">
        {views.map(({ key, label, icon: Icon }) => (
          <button aria-current={selected === key ? 'page' : undefined} className={selected === key ? 'is-selected' : ''} key={key} onClick={() => setSearchParams(key === 'professionals' ? {} : { kind: key })} type="button">
            <Icon aria-hidden="true" size={19} />{label}
          </button>
        ))}
      </nav>

      {selected === 'professionals' && (
        <section aria-labelledby="discover-pros-title" className="app-section">
          <div className="app-section__heading"><div><p className="app-eyebrow">Public profiles</p><h2 id="discover-pros-title">Meet Fixora professionals</h2></div></div>
          <PublishedProfessionals />
        </section>
      )}

      {selected === 'problems' && (
        <section className="app-unavailable-state">
          <span className="app-unavailable-state__icon"><Briefcase aria-hidden="true" size={24} /></span>
          <p className="app-eyebrow">Job discovery</p>
          <h2>Household requests aren’t available here yet.</h2>
          <p>The current Fixora database does not include public household requests, so there are no real jobs to show or apply for yet.</p>
          <Link className="app-secondary-action" to="/app/discover">Explore professionals <ArrowRight aria-hidden="true" size={17} /></Link>
        </section>
      )}

      {selected === 'projects' && (
        <section className="app-unavailable-state">
          <span className="app-unavailable-state__icon"><Images aria-hidden="true" size={24} /></span>
          <p className="app-eyebrow">Project stories</p>
          <h2>Completed work will have a home here.</h2>
          <p>There is no completed-project or portfolio data in the current database, so Fixora is not showing sample work as if it were real.</p>
          <Link className="app-secondary-action" to="/app/discover">Explore professional profiles <ArrowRight aria-hidden="true" size={17} /></Link>
        </section>
      )}
    </main>
  )
}
