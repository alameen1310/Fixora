import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ClockCounterClockwise, Compass, House, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { Avatar, Logo } from './UiPrimitives.jsx'
import './AuthenticatedAppShell.css'

const destinations = [
  { label: 'Home', to: '/app', icon: House, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
  { label: 'Profile', to: '/app/profile', icon: UserCircle },
]

export default function AuthenticatedAppShell() {
  const { profile } = useAuth()
  const location = useLocation()
  const isHome = location.pathname === '/app'
  const pageTitle = destinations.find(({ to }) => location.pathname === to)?.label || 'Professional'
  const isTabRoute = destinations.some(({ to }) => location.pathname === to)
  const [showCompactTitle, setShowCompactTitle] = useState(false)
  const scrollPositions = useRef({})
  const activePath = useRef(location.pathname)
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Account'

  function handleTabClick(targetPath) {
    if (location.pathname === targetPath) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const onScroll = () => setShowCompactTitle(!isHome && window.scrollY > 108)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome, location.pathname])

  useLayoutEffect(() => {
    scrollPositions.current[activePath.current] = window.scrollY
    activePath.current = location.pathname
    window.scrollTo(0, scrollPositions.current[location.pathname] || 0)
  }, [location.pathname])

  return (
    <div className="fixora-app">
      <a className="fixora-app__skip" href="#app-content">Skip to content</a>

      <header className="fixora-app__topbar">
        {isHome ? <Logo className="fixora-app__brand" to="/app" /> : <span aria-hidden="true" className="fixora-app__brand-placeholder" />}
        <span aria-hidden="true" className={`fixora-app__compact-title${showCompactTitle ? ' is-visible' : ''}`}>{pageTitle}</span>

        <nav aria-label="Main navigation" className="fixora-app__desktop-nav">
          {destinations.map(({ label, to, end }) => (
            <NavLink end={end} key={label} to={to}>{label}</NavLink>
          ))}
        </nav>

        <div className="fixora-app__account">
          <Link
            aria-label="View your profile"
            className="fixora-app__profile-link"
            to="/app/profile"
          >
            <span className="fixora-app__account-name">{firstName}</span>
            <Avatar name={profile?.full_name || 'Account'} size={36} />
          </Link>
        </div>
      </header>

      <div className={`fixora-app__viewport fixora-app__route-stage${isTabRoute ? ' fixora-app__route-stage--tab' : ''}`} id="app-content" key={location.pathname}>
        <Outlet />
      </div>

      <nav aria-label="Mobile navigation" className="fixora-app__mobile-nav">
        {destinations.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`}
            end={end}
            key={label}
            onClick={() => handleTabClick(to)}
            to={to}
          >
            {({ isActive }) => (
              <>
                <Icon aria-hidden="true" size={24} weight={isActive ? 'fill' : 'regular'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
