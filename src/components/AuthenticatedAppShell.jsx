import { NavLink, Outlet } from 'react-router-dom'
import { ClockCounterClockwise, Compass, House, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import SignOutAction from './SignOutAction.jsx'
import { Logo } from './UiPrimitives.jsx'
import './AuthenticatedAppShell.css'

const destinations = [
  { label: 'Home', to: '/app', icon: House, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
  { label: 'Profile', to: '/app/profile', icon: UserCircle },
]

export default function AuthenticatedAppShell() {
  const { profile } = useAuth()

  return (
    <div className="fixora-app">
      <a className="fixora-app__skip" href="#app-content">Skip to content</a>
      <header className="fixora-app__topbar">
        <Logo className="fixora-app__brand" to="/app" />
        <nav aria-label="Main navigation" className="fixora-app__desktop-nav">
          {destinations.map(({ label, to, end }) => (
            <NavLink end={end} key={label} to={to}>{label}</NavLink>
          ))}
        </nav>
        <div className="fixora-app__account">
          <span>{profile?.full_name?.split(' ')[0] || 'Your account'}</span>
          <SignOutAction />
        </div>
      </header>

      <div className="fixora-app__viewport" id="app-content"><Outlet /></div>

      <nav aria-label="Mobile navigation" className="fixora-app__mobile-nav">
        <NavLink end className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app">
          <House aria-hidden="true" size={22} weight="regular" /><span>Home</span>
        </NavLink>
        <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app/discover">
          <Compass aria-hidden="true" size={22} weight="regular" /><span>Discover</span>
        </NavLink>
        <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app/activity">
          <ClockCounterClockwise aria-hidden="true" size={22} weight="regular" /><span>Activity</span>
        </NavLink>
        <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app/profile">
          <UserCircle aria-hidden="true" size={22} weight="regular" /><span>Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}
