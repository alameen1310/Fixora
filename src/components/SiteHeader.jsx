import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'
import './SiteHeader.css'
import LanguageSelector from '../i18n/LanguageSelector.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const links = [
  { label: 'Discover', href: '#discovery' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For customers', href: '#for-customers' },
  { label: 'For professionals', href: '#for-professionals' },
]

function BrandMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 40 40" fill="none">
      <path d="M6.5 18.25 20 7l13.5 11.25V33H6.5V18.25Z" />
      <path d="M15.5 33V22.5h9V33M6.5 18.25 20 7l13.5 11.25" />
      <path d="m27.5 11.5 4.25-3.25v7" />
    </svg>
  )
}

export default function SiteHeader() {
  const { t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
          <a className="brand-lockup" href="#top" onClick={closeMenu} aria-label={t('Fixora home')}>
          <BrandMark />
          <span>fixora</span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          aria-label={t(menuOpen ? 'Close navigation menu' : 'Open navigation menu')}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>

        <nav
          aria-label="Main navigation"
          className={`primary-navigation${menuOpen ? ' is-open' : ''}`}
          id="primary-navigation"
        >
          <div className="primary-navigation__links">
            <LanguageSelector compact />
            {links.map((link) => (
              <a href={link.href} key={link.href} onClick={closeMenu}>
                {t(link.label)}
              </a>
            ))}
          </div>
          <div className="primary-navigation__actions">
            <Link className="nav-action nav-action--primary" onClick={closeMenu} to="/signup/customer">
              {t('Find a professional')}
            </Link>
            <Link className="nav-action nav-action--secondary" onClick={closeMenu} to="/signup/provider">
              {t('Offer your services')}
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
