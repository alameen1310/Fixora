import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Briefcase, ChatCircleDots, ClockCounterClockwise, Compass, House, Plus, UserCircle, X } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { avatarUrl } from '../lib/avatarImages.js'
import { Avatar, Logo } from './UiPrimitives.jsx'
import SignOutAction from './SignOutAction.jsx'
import { useDismissable } from '../hooks/useDismissable.js'
import PageContainer from './PageContainer.jsx'
import { FEATURES } from '../config/features.js'
import useUnreadMessageCount from './useUnreadMessageCount.js'
import useUnreadActivityCount from './useUnreadActivityCount.js'
import CommandPalette from './CommandPalette.jsx'
import OverlayPortal from './OverlayPortal.jsx'
import { useToast } from './ToastProvider.jsx'
import { supabase } from '../lib/supabase.js'
import LanguageSelector from '../i18n/LanguageSelector.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
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
  const { t } = useLanguage()
  const location = useLocation()
  const unreadMessages = useUnreadMessageCount(FEATURES.chat ? user?.id : null)
  const unreadActivity = useUnreadActivityCount(user?.id, profile?.account_type)
  const { showToast } = useToast()
  const totalUnread = unreadMessages + unreadActivity
  const isCustomer = profile?.account_type === 'customer'
  const isProvider = profile?.account_type === 'provider'
  const destinations = [
    { label: 'Home', to: '/app', icon: House, end: true },
    { label: isProvider ? 'Find work' : 'Discover', to: '/app/discover', icon: isProvider ? Briefcase : Compass },
    { label: 'Activity', to: '/app/activity', icon: ClockCounterClockwise },
    ...(FEATURES.chat ? [{ label: 'Messages', to: '/app/messages', icon: ChatCircleDots }] : []),
  ]
  const isChatRoute = location.pathname.startsWith('/app/messages')
  const isTabRoute = destinations.some(({ to }) => location.pathname === to)
  const showPostAction = FEATURES.posts && isCustomer
  const isFullScreenFlow = location.pathname === '/app/posts/new'
    || location.pathname === '/app/profile/edit'
    || /^\/app\/posts\/[^/]+(?:\/(edit|complete|applicants))?$/.test(location.pathname)
    || /^\/app\/messages\/[^/]+$/.test(location.pathname)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const hideTabBar = keyboardOpen || isFullScreenFlow
  const scrollPositions = useRef({})
  const activePath = useRef(location.pathname)
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Account'

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Fixora` : 'Fixora'
    try {
      if (totalUnread > 0) Promise.resolve(navigator.setAppBadge?.(totalUnread)).catch(() => {})
      else Promise.resolve(navigator.clearAppBadge?.()).catch(() => {})
    } catch { /* app badges are progressive enhancement */ }
  }, [totalUnread])

  useEffect(() => {
    if (!user?.id || !supabase) return undefined
    const seenPosts = new Set()
    const listeningSince = Date.now() - 5000
    const channel = supabase.channel(`marketplace-live-${user.id}`)
    if (profile?.account_type === 'provider') {
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'problem_posts' }, ({ new: post }) => {
        const publishedAt = post?.published_at ? new Date(post.published_at).getTime() : 0
        if (!post?.id || post.status !== 'open' || publishedAt < listeningSince || seenPosts.has(post.id)) return
        seenPosts.add(post.id)
        window.dispatchEvent(new CustomEvent('fixora:new-request'))
      })
    }
    if (profile?.account_type === 'customer') {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'problem_post_applications' }, async ({ new: application }) => {
        if (!application?.post_id || !application?.professional_id) return
        const [{ data: post }, { data: provider }] = await Promise.all([
          supabase.from('problem_posts').select('id, title').eq('id', application.post_id).eq('author_id', user.id).maybeSingle(),
          supabase.from('provider_profiles').select('profile_id, display_name').eq('profile_id', application.professional_id).maybeSingle(),
        ])
        if (!post) return
        showToast({ type: 'info', message: `${provider?.display_name || 'A professional'} applied to ${post.title || 'your request'}` })
        window.dispatchEvent(new CustomEvent('fixora:activity-refresh'))
      })
    }
    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [profile?.account_type, showToast, user?.id])

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

  useEffect(() => {
    const isMobileThread = window.matchMedia('(max-width: 899px)').matches
      && /^\/app\/messages\/[^/]+$/.test(location.pathname)
    if (!isMobileThread) return undefined
    const root = document.documentElement
    const body = document.body
    const prior = {
      rootPosition: root.style.position,
      rootInset: root.style.inset,
      rootOverflow: root.style.overflow,
      bodyPosition: body.style.position,
      bodyInset: body.style.inset,
      bodyOverflow: body.style.overflow,
    }
    root.classList.add('is-chat-thread-open')
    root.style.position = 'fixed'
    root.style.inset = '0'
    root.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.inset = '0'
    body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const syncViewport = () => {
      root.style.setProperty('--vv-height', `${viewport?.height ?? window.innerHeight}px`)
      root.style.setProperty('--vv-offset-top', `${viewport?.offsetTop ?? 0}px`)
    }
    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    return () => {
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      root.classList.remove('is-chat-thread-open')
      root.style.position = prior.rootPosition
      root.style.inset = prior.rootInset
      root.style.overflow = prior.rootOverflow
      root.style.removeProperty('--vv-height')
      root.style.removeProperty('--vv-offset-top')
      body.style.position = prior.bodyPosition
      body.style.inset = prior.bodyInset
      body.style.overflow = prior.bodyOverflow
    }
  }, [location.pathname])

  useLayoutEffect(() => {
    scrollPositions.current[activePath.current] = window.scrollY
    activePath.current = location.pathname
    window.scrollTo(0, scrollPositions.current[location.pathname] || 0)
  }, [location.pathname])

  return (
    <div className={`fixora-app${isChatRoute ? ' is-chat-route' : ''}${location.pathname === '/app/messages' ? ' is-messages-root' : ''}${mobileAccountOpen ? ' is-account-menu-open' : ''}${isFullScreenFlow ? ' is-focused-flow' : ''}`} style={{ '--tabbar-space': isFullScreenFlow ? '0px' : undefined }}>
      <a className="fixora-app__skip" href="#app-content">Skip to content</a>

      <aside aria-label="Application navigation" className="fixora-app__sidebar">
        <Logo className="fixora-app__sidebar-brand" to="/app" />
        <nav aria-label="Main navigation" className="fixora-app__side-nav">
          {destinations.map(({ label, to, icon: Icon, end }) => (
          <NavLink aria-label={t(label)} className={to === '/app/messages' ? 'fixora-app__messages-nav' : to === '/app/activity' ? 'fixora-app__activity-nav' : undefined} end={end} key={label} title={t(label)} to={to}>
              {({ isActive }) => <><Icon aria-hidden="true" size={22} weight={isActive ? 'fill' : 'regular'} /><span>{t(label)}</span>{to === '/app/messages' && unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} className="fixora-app__unread-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}{to === '/app/activity' && unreadActivity > 0 && <span aria-label={`${unreadActivity} unread updates`} className="fixora-app__unread-badge">{unreadActivity > 99 ? '99+' : unreadActivity}</span>}</>}
            </NavLink>
          ))}
        </nav>
        {showPostAction ? <div className="fixora-app__post-slot"><Link aria-label={t('Post a problem')} className="fixora-app__post-button" title={t('Post a problem')} to="/app/posts/new"><Plus aria-hidden="true" size={20} />{t('Post a problem')}</Link></div> : isProvider && <div className="fixora-app__post-slot"><Link aria-label={t('Find work')} className="fixora-app__post-button" title={t('Find work')} to="/app/discover"><Briefcase aria-hidden="true" size={20} />{t('Find work')}</Link></div>}
        <div className="fixora-app__sidebar-language"><LanguageSelector compact /></div>
        <AccountMenu firstName={firstName} isProvider={isProvider} profile={profile} user={user} />
      </aside>

      <header className={`fixora-app__topbar${!isTabRoute ? ' is-subroute' : ''}`}>
        <Logo className="fixora-app__brand" to="/app" />
        <div className="fixora-app__topbar-language"><LanguageSelector compact /></div>
        <div className="fixora-app__account">
        <AccountMenu firstName={firstName} isProvider={isProvider} mobile onOpenChange={setMobileAccountOpen} profile={profile} user={user} />
        </div>
      </header>

      <div className={`fixora-app__viewport fixora-app__route-stage${isTabRoute ? ' fixora-app__route-stage--tab' : ''}`} id="app-content" key={location.pathname}>
        <PageContainer className={isChatRoute ? 'page-container--chat' : ''}>
          <Outlet />
        </PageContainer>

      <CommandPalette isCustomer={isCustomer} />
      </div>

      <nav aria-label="Mobile navigation" className={`fixora-app__mobile-nav${hideTabBar ? ' is-hidden' : ''}${showPostAction ? ' has-post-action' : ''}`}>
        {MOBILE_TABS[isProvider ? 'provider' : 'customer'].filter(({ kind }) => kind !== 'post' || showPostAction).map(({ kind, label, to, icon: Icon, end }) => kind === 'post' ? (
          <Link aria-label="Post a problem" className="fixora-app__mobile-post" key="post" to="/app/posts/new">
            <Plus aria-hidden="true" size={25} weight="bold" />
          </Link>
        ) : (
          <NavLink className={({ isActive }) => `fixora-app__mobile-link${isActive ? ' is-active' : ''}`} end={end} key={label} onClick={() => handleTabClick(to)} to={to}>
        {({ isActive }) => <><Icon aria-hidden="true" size={24} weight={isActive ? 'fill' : 'regular'} /><span>{t(label)}</span>{to === '/app/messages' && unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} className="fixora-app__unread-badge">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}{to === '/app/activity' && unreadActivity > 0 && <span aria-label={`${unreadActivity} unread updates`} className="fixora-app__unread-badge">{unreadActivity > 9 ? '9+' : unreadActivity}</span>}</>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function AccountMenu({ firstName, isProvider, mobile = false, onOpenChange, profile, user }) {
  const [open, setOpen] = useState(false)
  const boundaryRef = useRef(null)
  const closeMenu = () => {
    setOpen(false)
    if (mobile) onOpenChange?.(false)
  }
  useDismissable({ boundaryRef, open, onDismiss: closeMenu })
  const toggleMenu = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (mobile) onOpenChange?.(nextOpen)
  }
  return <div className={`account-menu${mobile ? ' is-mobile' : ''}`} ref={boundaryRef}>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={mobile ? 'Open account menu' : 'Account actions'} className={mobile ? 'fixora-app__profile-link' : 'fixora-app__sidebar-account'} onClick={toggleMenu} type="button">
      {!mobile && <Avatar name={profile?.full_name || firstName} size={40} src={avatarUrl(profile?.avatar_path)} />}
      <span className="fixora-app__account-name">{firstName}</span>
      {mobile && <Avatar name={profile?.full_name || firstName} size={40} src={avatarUrl(profile?.avatar_path)} />}
    </button>
    {open && mobile && <OverlayPortal><button aria-label="Close account menu" className="account-menu__backdrop" onClick={closeMenu} type="button" /><AccountMenuPanel closeMenu={closeMenu} firstName={firstName} isProvider={isProvider} profile={profile} user={user} mobile /> </OverlayPortal>}
    {open && !mobile && <AccountMenuPanel closeMenu={closeMenu} firstName={firstName} isProvider={isProvider} profile={profile} user={user} />}
  </div>
}

function AccountMenuPanel({ closeMenu, firstName, isProvider, mobile = false, profile, user }) {
  const { t } = useLanguage()
  return <section aria-label="Account menu" aria-modal={mobile || undefined} className="account-menu__panel" role="dialog">
    <button aria-label="Close account menu" className="account-menu__close" onClick={closeMenu} type="button"><X size={18} /></button>
    <div className="account-menu__identity"><Avatar name={profile?.full_name || firstName} size={56} src={avatarUrl(profile?.avatar_path)} /><div><strong>{profile?.full_name || firstName}</strong><small>{user?.email}</small>{!isProvider && <span className="account-menu__role">Customer</span>}</div></div>
    <nav aria-label={t('Account')} className="account-menu__links"><Link onClick={closeMenu} to="/app/profile"><UserCircle size={18} />{t('View profile')}</Link><Link onClick={closeMenu} to="/app/profile/edit"><Briefcase size={18} />{t('Edit profile')}</Link></nav>
    <div className="account-menu__language"><LanguageSelector /></div>
    <SignOutAction className="account-menu__signout" location="profile" />
  </section>
}
