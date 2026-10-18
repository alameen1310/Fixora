import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import './AccountHomePage.css'

export default function AccountHomePage() {
  const { user, profile } = useAuth()
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function signOut() {
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      navigate('/', { replace: true })
    } catch {
      setError('We couldn’t sign you out. Please try again.')
    }
  }

  return (
    <main className="account-home">
      <header className="account-home__header"><Link to="/" className="account-home__brand">fixora</Link><button onClick={signOut} type="button"><SignOut aria-hidden="true" size={18} /> Sign out</button></header>
      <section className="account-home__content">
        <p className="auth-kicker">Your Fixora account</p>
        <h1>You’re all set, {profile?.full_name?.split(' ')[0] || 'welcome'}.</h1>
        <p>Your {profile?.account_type} profile is ready. Fixora’s marketplace and job tools are still being built.</p>
        <p className="account-home__email">Signed in as {user?.email}</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  )
}
