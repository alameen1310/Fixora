import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Briefcase, House, CaretRight } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingIndicator from '../components/LoadingIndicator.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { Logo } from '../components/UiPrimitives.jsx'
import { supabase } from '../lib/supabase.js'
import './AccountTypePage.css'

export default function AccountTypePage() {
  const { profile, setProfile, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [pendingType, setPendingType] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { showToast } = useToast()

  if (profile?.account_type) {
    return <Navigate replace to={profile.onboarding_completed_at ? '/app' : `/onboarding/${profile.account_type}`} />
  }

  async function choose(type) {
    setBusy(true)
    setPendingType(type)
    setError('')
    try {
      const { error: chooseError } = await supabase.rpc('choose_account_type', { requested_type: type })
      if (chooseError) throw chooseError
      setProfile((current) => current ? { ...current, account_type: type } : current)
      showToast({ type: 'success', message: 'Your Fixora account type is saved.' })
      navigate(`/onboarding/${type}`, { replace: true })
    } catch {
      setError('We couldn’t save that choice. Please try again.')
    } finally {
      setBusy(false)
      setPendingType('')
    }
  }

  return (
    <div className="account-type-page">
      <header className="account-type-header">
        <Logo to="/" />
        <button
          type="button"
          className="account-type-signout"
          onClick={() => signOut()}
          disabled={busy}
        >
          Sign out
        </button>
      </header>

      <main className="account-type-main">
        <section className="account-type-card" aria-labelledby="account-type-title">
          <p className="account-type-kicker">Welcome to Fixora</p>
          <h1 id="account-type-title" className="account-type-title">How will you use Fixora?</h1>
          <p className="account-type-subtitle">
            Choose the account that fits you best. This choice is permanent and customizes your Fixora experience.
          </p>

          <div className="account-type-options" role="group" aria-label="Account types">
            <button
              disabled={busy}
              onClick={() => choose('customer')}
              type="button"
              className={`account-type-btn ${pendingType === 'customer' ? 'is-loading' : ''}`}
            >
              <div className="account-type-icon-box" aria-hidden="true">
                <House size={26} weight="duotone" />
              </div>
              <div className="account-type-btn-content">
                <strong className="account-type-btn-title">I need help at home</strong>
                <span className="account-type-btn-desc">Discover skilled plumbers, electricians, painters, and household artisans.</span>
              </div>
              <div className="account-type-btn-action" aria-hidden="true">
                {pendingType === 'customer' ? <LoadingIndicator /> : <CaretRight size={20} weight="bold" />}
              </div>
            </button>

            <button
              disabled={busy}
              onClick={() => choose('provider')}
              type="button"
              className={`account-type-btn ${pendingType === 'provider' ? 'is-loading' : ''}`}
            >
              <div className="account-type-icon-box" aria-hidden="true">
                <Briefcase size={26} weight="duotone" />
              </div>
              <div className="account-type-btn-content">
                <strong className="account-type-btn-title">I offer a service</strong>
                <span className="account-type-btn-desc">Create your professional profile, showcase your expertise, and connect with clients.</span>
              </div>
              <div className="account-type-btn-action" aria-hidden="true">
                {pendingType === 'provider' ? <LoadingIndicator /> : <CaretRight size={20} weight="bold" />}
              </div>
            </button>
          </div>

          {error && <p className="onboarding-error" role="alert">{error}</p>}
        </section>
      </main>
    </div>
  )
}
