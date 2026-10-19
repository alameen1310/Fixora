import { LockKey, MapPin, UsersThree } from '@phosphor-icons/react'
import { AuthHeader, Logo } from './UiPrimitives.jsx'
import heroPhoto from '../assets/plumber-at-work.png'
import './AuthLayout.css'

const benefits = [
  { icon: MapPin, text: 'Find professionals by service and location' },
  { icon: UsersThree, text: 'One place for customers and professionals' },
  { icon: LockKey, text: 'Your phone number stays private' },
]

export default function AuthLayout({ children }) {
  return (
    <main className="auth-layout">
      <aside aria-label="About Fixora" className="auth-layout__brand-panel">
        <div className="auth-layout__brand-inner">
          <Logo className="auth-layout__logo" />
          <div className="auth-layout__message">
            <p className="auth-layout__eyebrow">Household services, made clearer</p>
            <h1>The right professional for every home fix.</h1>
            <ul>
              {benefits.map(({ icon: Icon, text }) => <li key={text}><Icon aria-hidden="true" size={20} weight="duotone" /><span>{text}</span></li>)}
            </ul>
          </div>
          <figure className="auth-layout__photo">
            <img alt="Plumber working on residential bathroom pipes" decoding="async" fetchPriority="high" height="1200" src={heroPhoto} width="1600" />
            <figcaption>Photography is illustrative.</figcaption>
          </figure>
        </div>
      </aside>
      <div className="auth-layout__form-side">
        <div className="auth-layout__mobile-brand">
          <img alt="" aria-hidden="true" className="auth-layout__mobile-photo" decoding="async" fetchPriority="high" height="1200" src={heroPhoto} width="1600" />
          <AuthHeader className="auth-layout__mobile-header" /><p>The right professional for every home fix.</p>
        </div>
        <div className="auth-layout__content">
          <AuthHeader className="auth-layout__header" />
          {children}
        </div>
      </div>
    </main>
  )
}
