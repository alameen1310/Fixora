import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Briefcase, ChatCircleDots, ClockCounterClockwise, Compass, House, Plus, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { Avatar, Logo } from './UiPrimitives.jsx'
import PageContainer from './PageContainer.jsx'
import { FEATURES } from '../config/features.js'
import useUnreadMessageCount from './useUnreadMessageCount.js'
import './AuthenticatedAppShell.css'

const MOBILE_TABS = {
  customer: [
    { label: 'Home', to: '/app', icon: House, end: true },
    { label: 'Discover', to: '/app/discover', icon: Compass },
    { kind: 'post' },
    { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
    { label: 'Messages', to: '/app/messages', icon: ChatCircleDots },
  ],
  provider: [
    { label: 'Home', to: '/app', icon: House, end: true },
    { label: 'Find work', to: '/app/discover', icon: Briefcase },
    { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
    { label: 'Messages', to: '/app/messages', icon: ChatCircleDots },
  ],
}

export default function AuthenticatedAppShell() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const unreadMessages = useUnreadMessageCount(FEATURES.chat ? user?.id : null)
  const isCustomer = profile?.account_type === 'customer'
  const isProvider = profile?.account_type === 'provider'
  const destinations = [
    { label: 'Home', to: '/app', icon: House, end: true },
    { label: isProvider ? 'Find work' : 'Discover', to: '/app/discover', icon: isProvider ? Briefcase : Compass },
    { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
    ...(FEATURES.chat ? [{ label: 'Messages', to: '/app/messages', icon: ChatCircleDots }] : []),
    { label: 'Profile', to: '/app/profile', icon: UserCircle },
  ]
  const isChatRoute = location.pathname.startsWith('/app/messages')
  const isTabRoute = destinations.some(({ to }) => location.pathname === to)
  const showPostAction = FEATURES.posts && isCustomer
  const isFullScreenFlow = location.pathname === '/app/posts/new'
    || /^\/app\/posts\/[^/]+\/(edit|complete)$/.test(location.pathname)
    || /^\/app\/messages\/[^/]+$/.test(location.pathname)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const hideTabBar = keyboardOpen || isFullScreenFlow
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
    const viewport = window.visualViewport
    const updateKeyboard = () => {
      const focused = Boolean(document.activeElement?.matches('input, textarea, select'))
      const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0
      const keyboardInset = focused && inset > 80 ? inset : 0
      setKeyboardOpen(keyboardInset > 0)
      document.documentElement.style.setProperty('--kb-inset', `${keyboardInset}px`)
      document.documentElement.style.setProperty('--keyboard-offset', `${keyboardInset}px`)
      if (viewport) document.documentElement.style.setProperty('--visual-viewport-height', `${keyboardInset ? viewport.height + viewport.offsetTop : window.innerHeight}px`)
    }
    updateKeyboard()
    document.addEventListener('focusin', updateKeyboard)
    document.addEventListener('focusout', updateKeyboard)
    viewport?.addEventListener('resize', updateKeyboard)
    viewport?.addEventListener('scroll', updateKeyboard)
    return () => {
      document.removeEventListener('focusin', updateKeyboard)
      document.removeEventListener('focusout', updateKeyboard)
      viewport?.removeEventListener('resize', updateKeyboard)
      viewport?.removeEventListener('scroll', updateKeyboard)
      document.documentElement.style.removeProperty('--kb-inset')
      document.documentElement.style.removeProperty('--keyboard-offset')
      document.documentElement.style.removeProperty('--visual-viewport-height')
    }
  }, [])

  useLayoutEffect(() => {
    scrollPositions.current[activePath.current] = window.scrollY
    activePath.current = location.pathname
    window.scrollTo(0, scrollPositions.current[location.pathname] || 0)
  }, [location.pathname])

  return (
    <div className={`fixora-app${isChatRoute ? ' is-chat-route' : ''}${location.pathname === '/app/messages' ? ' is-messages-root' : ''}`} style={{ '--tabbar-space': isFullScreenFlow ? '0px' : undefined }}>
      <a className="fixora-app__skip" href="#app-content">Skip to content</a>

      <aside aria-label="Application navigation" className="fixora-app__sidebar">
        <Logo className="fixora-app__sidebar-brand" to="/app" />
        <nav aria-label="Main navigation" className="fixora-app__side-nav">
          {destinations.map(({ label, to, icon: Icon, end }) => (
            <NavLink aria-label={label} className={to === '/app/messages' ? 'fixora-app__messages-nav' : undefined} end={end} key={label} title={label} to={to}>
              {({ isActive }) => <><Icon aria-hidden="true" size={22} weight={isActive ? 'fill' : 'regular'} /><span>{label}</span>{to === '/app/messages' && unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} className="fixora-app__unread-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}</>}
            </NavLink>
          ))}
        </nav>
        {showPostAction ? <div className="fixora-app__post-slot"><Link className="fixora-app__post-button" to="/app/posts/new"><Plus aria-hidden="true" size={20} />Post a problem</Link></div> : isProvider && <div className="fixora-app__post-slot"><Link className="fixora-app__post-button" to="/app/discover"><Briefcase aria-hidden="true" size={20} />Find work</Link></div>}
        <Link aria-label="View your profile" className="fixora-app__sidebar-account" to="/app/profile">
          <Avatar name={profile?.full_name || 'Account'} size={40} />
          <span>{firstName}</span>
        </Link>
      </aside>

      <header className={`fixora-app__topbar${!isTabRoute ? ' is-subroute' : ''}`}>
        <Logo className="fixora-app__brand" to="/app" />
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
        <PageContainer className={isChatRoute ? 'page-container--chat' : ''}>
          <Outlet />
        </PageContainer>
      </div>

      <nav aria-label="Mobile navigation" className={`fixora-app__mobile-nav${hideTabBar ? ' is-hidden' : ''}${showPostAction ? ' has-post-action' : ''}`}>
        {MOBILE_TABS[isProvider ? 'provider' : 'customer'].filter(({ kind }) => kind !== 'post' || showPostAction).map(({ kind, label, to, icon: Icon, end }) => kind === 'post' ? (
          <Link aria-label="Post a problem" className="fixora-app__mobile-post" key="post" to="/app/posts/new">
            <Plus aria-hidden="true" size={25} weight="bold" />
          </Link>
        ) : (
          <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} end={end} key={label} onClick={() => handleTabClick(to)} to={to}>
            {({ isActive }) => <><Icon aria-hidden="true" size={24} weight={isActive ? 'fill' : 'regular'} /><span>{label}</span>{to === '/app/messages' && unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} className="fixora-app__unread-badge">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}</>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
