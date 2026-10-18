import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ClockCounterClockwise, Compass, House, Plus, SignOut, UserCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import './AuthenticatedAppShell.css'

const destinations = [
  { label: 'Home', to: '/app', icon: House, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
  { label: 'Profile', to: '/app/profile', icon: UserCircle },
]

export default function AuthenticatedAppShell() {
  const { profile } = useAuth()
  const [signOutError, setSignOutError] = useState('')
  const navigate = useNavigate()
  const isProvider = profile?.account_type === 'provider'

  async function signOut() {
    setSignOutError('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/', { replace: true })
    } catch {
      setSignOutError('We couldn’t sign you out. Please try again.')
    }
  }

  return (
    <div className="fixora-app">
      <a className="fixora-app__skip" href="#app-content">Skip to content</a>
      <header className="fixora-app__topbar">
        <NavLink aria-label="Fixora home" className="fixora-app__brand" to="/app">fixora<span>.</span></NavLink>
        <nav aria-label="Main navigation" className="fixora-app__desktop-nav">
          {destinations.map(({ label, to, end }) => (
            <NavLink end={end} key={label} to={to}>{label}</NavLink>
          ))}
        </nav>
        <div className="fixora-app__account">
          {isProvider
            ? <NavLink className="fixora-app__desktop-action" to="/app/discover?kind=problems">Find jobs</NavLink>
            : <button aria-describedby="post-problem-unavailable" className="fixora-app__desktop-action is-unavailable" disabled type="button">Post a problem</button>}
          <span>{profile?.full_name?.split(' ')[0] || 'Your account'}</span>
          <button aria-label="Sign out" className="fixora-app__signout" onClick={signOut} type="button"><SignOut aria-hidden="true" size={19} /><span>Sign out</span></button>
        </div>
      </header>

      {signOutError && <p className="fixora-app__signout-error" role="alert">{signOutError}</p>}
      <div className="fixora-app__viewport" id="app-content"><Outlet /></div>

      <nav aria-label="Mobile navigation" className="fixora-app__mobile-nav">
        <NavLink end className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app">
          <House aria-hidden="true" size={22} weight="regular" /><span>Home</span>
        </NavLink>
        <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app/discover">
          <Compass aria-hidden="true" size={22} weight="regular" /><span>Discover</span>
        </NavLink>
        {isProvider ? (
          <NavLink aria-label="Find jobs" className="fixora-app__mobile-action" to="/app/discover?kind=problems">
            <span className="fixora-app__mobile-action-icon"><Plus aria-hidden="true" size={23} weight="bold" /></span><span>Find jobs</span>
          </NavLink>
        ) : (
          <button aria-describedby="post-problem-unavailable" className="fixora-app__mobile-action is-unavailable" disabled type="button">
            <span className="fixora-app__mobile-action-icon"><Plus aria-hidden="true" size={23} weight="bold" /></span><span>Post</span>
          </button>
        )}
        <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app/activity">
          <ClockCounterClockwise aria-hidden="true" size={22} weight="regular" /><span>Activity</span>
        </NavLink>
        <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} to="/app/profile">
          <UserCircle aria-hidden="true" size={22} weight="regular" /><span>Profile</span>
        </NavLink>
      </nav>
      {!isProvider && <span className="fixora-app__sr-only" id="post-problem-unavailable">Posting a household problem is not available yet.</span>}
    </div>
  )
}
