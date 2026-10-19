import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Logo } from './UiPrimitives.jsx'

function AuthMessage({ children }) {
  return (
    <main className="account-state">
      <div className="account-state__panel">{children}</div>
    </main>
  )
}

function SigningOut() {
  return <main className="account-state" role="status"><Logo /><p>Signing out…</p></main>
}

export default function ProtectedRoute({ children, onboarding = false }) {
  const location = useLocation()
  const { authConfigured, user, profile, loading, sessionError, retrySession, profileLoading, profileError, refreshProfile } = useAuth()
  try {
    if (window.sessionStorage.getItem('fixora.signingOut') === '1') return <SigningOut />
  } catch { /* Continue through the normal session state when storage is blocked. */ }

  if (!authConfigured) {
    return <AuthMessage><h1>Connect Fixora to Supabase</h1><p>Add the required Vite environment variables to enable accounts.</p></AuthMessage>
  }
  if (loading) return <AuthMessage><p role="status">Checking your session…</p></AuthMessage>
  if (sessionError) {
    return (
      <AuthMessage>
        <h1>We couldn’t restore your session</h1>
        <p>Check your connection and try again. You’ll stay on this page while Fixora checks your account.</p>
        <button className="account-action" onClick={retrySession} type="button">Try again</button>
      </AuthMessage>
    )
  }
  if (!user) {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate replace state={{ returnTo }} to="/auth/login" />
  }
  if (profileLoading) return <AuthMessage><p role="status">Loading your Fixora profile…</p></AuthMessage>
  if (profileError || !profile) {
    return (
      <AuthMessage>
        <h1>We couldn’t load your profile</h1>
        <p>Please try again. Your account details are still protected.</p>
        <button className="account-action" onClick={refreshProfile} type="button">Try again</button>
      </AuthMessage>
    )
  }
  if (!profile.account_type) {
    if (onboarding && location.pathname === '/onboarding/account-type') return children
    return <Navigate replace to="/onboarding/account-type" />
  }

  const correctOnboardingPath = `/onboarding/${profile.account_type}`
  if (onboarding) {
    if (profile.onboarding_completed_at) return <Navigate replace to="/app" />
    if (location.pathname !== correctOnboardingPath) return <Navigate replace to={correctOnboardingPath} />
    return children
  }

  if (!profile.onboarding_completed_at) return <Navigate replace to={correctOnboardingPath} />
  return children
}
