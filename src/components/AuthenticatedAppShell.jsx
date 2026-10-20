import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChatCircleDots, ClockCounterClockwise, Compass, House, Plus, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { Avatar, Logo } from './UiPrimitives.jsx'
import { FEATURES } from '../config/features.js'
import useUnreadMessageCount from './useUnreadMessageCount.js'
import './AuthenticatedAppShell.css'

const destinations = [
  { label: 'Home', to: '/app', icon: House, end: true },
  { label: 'Discover', to: '/app/discover', icon: Compass },
  { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
  { label: 'Profile', to: '/app/profile', icon: UserCircle },
]

export default function AuthenticatedAppShell() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const unreadMessages = useUnreadMessageCount(FEATURES.chat ? user?.id : null)
  const isHome = location.pathname === '/app'
  const isChatRoute = location.pathname.startsWith('/app/messages')
  const pageTitle = destinations.find(({ to }) => location.pathname === to)?.label
    || (location.pathname === '/app/my-posts' ? 'My Posts' : location.pathname.startsWith('/app/posts/') ? 'Post' : 'Professional')
  const isTabRoute = destinations.some(({ to }) => location.pathname === to)
  const isCustomer = profile?.account_type === 'customer'
  const showPostAction = FEATURES.posts && isCustomer
  const [showCompactTitle, setShowCompactTitle] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const hideTabBar = keyboardOpen || location.pathname.startsWith('/app/professionals/')
    || location.pathname === '/app/posts/new' || /^\/app\/posts\/[^/]+\/edit$/.test(location.pathname) || isChatRoute
  const scrollPositions = useRef({})
  const activePath = useRef(location.pathname)
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Account'

  function handleTabClick(targetPath) {
    if (location.pathname === targetPath) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
      if (targetPath === '/app') window.dispatchEvent(new CustomEvent('fixora:home-refresh'))
    }
  }

  useEffect(() => {
    const onScroll = () => setShowCompactTitle(!isHome && window.scrollY > 108)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome, location.pathname])

  useEffect(() => {
    const updateKeyboard = () => setKeyboardOpen(Boolean(document.activeElement?.matches('input, textarea, select')))
    document.addEventListener('focusin', updateKeyboard)
    document.addEventListener('focusout', updateKeyboard)
    return () => {
      document.removeEventListener('focusin', updateKeyboard)
      document.removeEventListener('focusout', updateKeyboard)
    }
  }, [])

  useLayoutEffect(() => {
    scrollPositions.current[activePath.current] = window.scrollY
    activePath.current = location.pathname
    window.scrollTo(0, scrollPositions.current[location.pathname] || 0)
  }, [location.pathname])

  return (
    <div className={`fixora-app${isChatRoute ? ' is-chat-route' : ''}`}>
      <a className="fixora-app__skip" href="#app-content">Skip to content</a>

      <aside aria-label="Application navigation" className="fixora-app__sidebar">
        <Logo className="fixora-app__sidebar-brand" to="/app" />
        <nav aria-label="Main navigation" className="fixora-app__side-nav">
          {destinations.map(({ label, to, icon: Icon, end }) => (
            <NavLink aria-label={label} end={end} key={label} title={label} to={to}>
              {({ isActive }) => <><Icon aria-hidden="true" size={22} weight={isActive ? 'fill' : 'regular'} /><span>{label}</span></>}
            </NavLink>
          ))}
          {FEATURES.chat && <NavLink aria-label="Messages" className="fixora-app__messages-nav" title="Messages" to="/app/messages">
            {({ isActive }) => <><ChatCircleDots aria-hidden="true" size={22} weight={isActive ? 'fill' : 'regular'} /><span>Messages</span>{unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} className="fixora-app__unread-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}</>}
          </NavLink>}
        </nav>
        {showPostAction && <div className="fixora-app__post-slot"><Link className="fixora-app__post-button" to="/app/posts/new"><Plus aria-hidden="true" size={20} />Post a problem</Link></div>}
        <Link aria-label="View your profile" className="fixora-app__sidebar-account" to="/app/profile">
          <Avatar name={profile?.full_name || 'Account'} size={40} />
          <span>{firstName}</span>
        </Link>
      </aside>

      <header className="fixora-app__topbar">
        <Logo className="fixora-app__brand" to="/app" />
        <span aria-hidden="true" className={`fixora-app__compact-title${showCompactTitle ? ' is-visible' : ''}`}>{pageTitle}</span>

        {FEATURES.chat && <Link aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'} className="fixora-app__messages-shortcut" to="/app/messages">
          <ChatCircleDots aria-hidden="true" size={23} />
          {unreadMessages > 0 && <span aria-hidden="true" className="fixora-app__unread-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
        </Link>}

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

      <nav aria-label="Mobile navigation" className={`fixora-app__mobile-nav${hideTabBar ? ' is-hidden' : ''}${showPostAction ? ' has-post-action' : ''}`}>
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
        )).flatMap((link, index) => index === 2 && showPostAction ? [(
          <Link aria-label="Post a problem" className="fixora-app__mobile-post" key="post" to="/app/posts/new">
            <Plus aria-hidden="true" size={25} weight="bold" />
          </Link>
        ), link] : [link])}
      </nav>
    </div>
  )
}
