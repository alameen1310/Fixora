import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Briefcase, House, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import './AccountTypePage.css'

export default function AccountTypePage() {
  const { profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  if (profile?.account_type) {
    return <Navigate replace to={profile.onboarding_completed_at ? '/app' : `/onboarding/${profile.account_type}`} />
  }

  async function choose(type) {
    setBusy(true)
    setError('')
    try {
      const { error: chooseError } = await supabase.rpc('choose_account_type', { requested_type: type })
      if (chooseError) throw chooseError
      const { error: profileError } = await refreshProfile()
      if (profileError) throw profileError
      navigate(`/onboarding/${type}`, { replace: true })
    } catch {
      setError('We couldn’t save that choice. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-type-page">
      <section className="account-type-card" aria-labelledby="account-type-title">
        <p className="auth-kicker">Welcome to Fixora</p>
        <h1 id="account-type-title">How will you use Fixora?</h1>
        <p>Choose the account that fits you. This choice can’t be changed later.</p>
        <div className="account-type-options">
          <button disabled={busy} onClick={() => choose('customer')} type="button">
            <House aria-hidden="true" size={24} weight="duotone" />
            <span><strong>I need help at home</strong><small>Discover skilled people for household work.</small></span>
            <ArrowRight aria-hidden="true" size={20} />
          </button>
          <button disabled={busy} onClick={() => choose('provider')} type="button">
            <Briefcase aria-hidden="true" size={24} weight="duotone" />
            <span><strong>I offer a service</strong><small>Showcase your work and connect with customers.</small></span>
            <ArrowRight aria-hidden="true" size={20} />
          </button>
        </div>
        {error && <p className="onboarding-error" role="alert">{error}</p>}
      </section>
    </main>
  )
}
