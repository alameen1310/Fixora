import { LockKey, MapPin, UsersThree } from '@phosphor-icons/react'
import { AuthHeader, Logo } from './UiPrimitives.jsx'
import heroPhoto from '../assets/plumber-at-work.png'
import './AuthLayout.css'
import LanguageSelector from '../i18n/LanguageSelector.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const benefits = [
  { icon: MapPin, text: 'Find professionals by service and location' },
  { icon: UsersThree, text: 'One place for customers and professionals' },
  { icon: LockKey, text: 'Your phone number stays private' },
]

export default function AuthLayout({ children, wide = false, backTo = '/', backLabel = 'Back to Fixora home', login = false }) {
  const { t } = useLanguage()
  return (
    <main className="auth-layout">
      <aside aria-label="About Fixora" className="auth-layout__brand-panel">
        <div className="auth-layout__brand-inner">
          <Logo className="auth-layout__logo" />
          <div className="auth-layout__message">
            <p className="auth-layout__eyebrow">{t('Household services, made clearer')}</p>
            <h1>{t('The right professional for every home fix.')}</h1>
            <ul>
              {benefits.map(({ icon: Icon, text }) => <li key={text}><Icon aria-hidden="true" size={20} weight="duotone" /><span>{t(text)}</span></li>)}
            </ul>
          </div>
          <figure className="auth-layout__photo">
            <img alt={t('Plumber working on exposed residential bathroom pipes')} decoding="async" fetchPriority="high" height="1200" src={heroPhoto} width="1600" />
            <figcaption>{t('Photography shown is illustrative.')}</figcaption>
          </figure>
        </div>
      </aside>
      <div className={`auth-layout__form-side${wide ? ' is-wide' : ''}`}>
        <div className="auth-layout__mobile-brand">
          <img alt="" aria-hidden="true" className="auth-layout__mobile-photo" decoding="async" fetchPriority="high" height="1200" src={heroPhoto} width="1600" />
          <AuthHeader backLabel={t(backLabel)} backTo={backTo} className="auth-layout__mobile-header" /><p>{t('The right professional for every home fix.')}</p>
        </div>
        <div className={`auth-layout__content${wide ? ' auth-layout__content--wide' : ''}${login ? ' auth-layout__content--login' : ''}`}>
          <LanguageSelector compact />
          <AuthHeader backLabel={t(backLabel)} backTo={backTo} className="auth-layout__header" />
          {login ? <div className="auth-layout__login-content">{children}</div> : children}
        </div>
      </div>
    </main>
  )
}
