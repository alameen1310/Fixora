import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowClockwise, CheckCircle, CircleNotch, HouseLine, ShieldCheck, Wrench } from '@phosphor-icons/react'
import { ReducedMotionConfig, blur, scale, shift, spring, transition, useShouldReduceMotion, useTempoTransition } from '@animate-ui/react/utils/motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { authConfigured, supabase } from '../lib/supabase.js'
import './AuthCallbackPage.css'

function readCallbackParams() {
  return new URLSearchParams([
    window.location.search.replace(/^\?/, ''),
    window.location.hash.replace(/^#/, ''),
  ].filter(Boolean).join('&'))
}

function callbackErrorMessage(params) {
  const code = params.get('error_code') || params.get('error') || ''
  if (/expired|otp_expired/i.test(code)) return 'This confirmation link has expired. Return to Fixora and use the available account recovery options.'
  if (/access_denied/i.test(code)) return 'This sign-in was cancelled. You can safely return and try again.'
  if (code || params.has('error_description')) return 'We couldn’t verify this link. Return to sign in and request a new one if needed.'
  return ''
}

function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const destination = new URL(value, window.location.origin)
    if (destination.origin !== window.location.origin) return null
    if (destination.pathname !== '/app' && !destination.pathname.startsWith('/app/')) return null
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return null
  }
}

function getDestination(profile, returnTo) {
  if (!profile?.account_type) return '/onboarding/account-type'
  if (!profile.onboarding_completed_at) return `/onboarding/${profile.account_type}`
  return returnTo || '/app'
}

async function chooseAccountType(type) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)
  try {
    const { data, error } = await supabase
      .rpc('choose_account_type', { requested_type: type })
      .abortSignal(controller.signal)
    if (error) throw error
    return data
  } finally {
    window.clearTimeout(timer)
  }
}

function CallbackExperience() {
  const [phase, setPhase] = useState('verify')
  const [failure, setFailure] = useState('')
  const [retryIndex, setRetryIndex] = useState(0)
  const { user, loading, sessionError, retrySession, profile, profileLoading, profileError, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useShouldReduceMotion()
  const entranceTransition = useTempoTransition(spring.entrance)
  const swapTransition = useTempoTransition(transition.swap)
  const params = useMemo(readCallbackParams, [])

  useEffect(() => {
    let active = true
    const callbackError = callbackErrorMessage(params)

    if (params.get('type') === 'recovery') {
      navigate('/auth/reset-password', { replace: true })
      return undefined
    }
    if (callbackError) {
      setFailure(callbackError)
      return undefined
    }
    if (!authConfigured) {
      setFailure('Fixora account services are not configured yet. Please try again later.')
      return undefined
    }
    if (loading) {
      setPhase('verify')
      setFailure('')
      return undefined
    }
    if (sessionError) {
      setFailure(sessionError)
      return undefined
    }
    if (!user) {
      setFailure('We couldn’t find an active session for this link. It may be expired or incomplete. Return to sign in to continue.')
      return undefined
    }
    if (profileLoading) {
      setPhase('prepare')
      setFailure('')
      return undefined
    }
    if (profileError || !profile) {
      setFailure(profileError || 'Your Fixora profile is not ready yet. Please try loading it again.')
      return undefined
    }

    async function resolveDestination() {
      let accountType = profile.account_type
      if (!accountType) {
        let signupType = user.user_metadata?.fixora_signup_type
        try {
          signupType ||= window.sessionStorage.getItem('fixora.signupType')
        } catch {
          // Signup intent may be unavailable in restricted storage environments.
        }
        if (signupType === 'customer' || signupType === 'provider') {
          setPhase('prepare')
          accountType = await chooseAccountType(signupType)
          const refreshed = await refreshProfile()
          if (refreshed.error || !refreshed.data) throw refreshed.error || new Error('Your account details are still being prepared.')
          accountType = refreshed.data.account_type || accountType
        }
      }

      try {
        window.sessionStorage.removeItem('fixora.signupType')
        if (accountType !== 'provider') window.sessionStorage.removeItem('fixora.providerType')
      } catch {
        // Storage cleanup is best-effort and must not block the authenticated session.
      }
      if (!active) return
      const destinationProfile = accountType === profile.account_type ? profile : { ...profile, account_type: accountType }
      setPhase('continue')
      navigate(getDestination(destinationProfile, safeReturnTo(location.state?.returnTo)), { replace: true })
    }

    resolveDestination().catch(() => {
      if (active) setFailure('Your session is active, but Fixora could not finish preparing your account. Retry, or continue setup from sign in.')
    })

    return () => { active = false }
  }, [loading, sessionError, user?.id, user?.user_metadata?.fixora_signup_type, profileLoading, profileError, profile?.id, profile?.account_type, profile?.onboarding_completed_at, retryIndex, navigate, refreshProfile, location.state?.returnTo])

  async function retry() {
    setFailure('')
    setPhase('verify')
    if (sessionError || (!user && !loading)) await retrySession()
    else if (user) await refreshProfile()
    setRetryIndex((value) => value + 1)
  }

  const isError = Boolean(failure)
  const activePhase = isError ? 'error' : phase
  const messages = {
    verify: { title: 'Signing you in…', detail: 'We’re restoring your Fixora session securely.' },
    prepare: { title: 'Preparing your account', detail: 'Your profile and next setup step are being brought together.' },
    continue: { title: 'Taking you to Fixora', detail: 'Your session is ready. Opening the right place for you now.' },
    error: { title: 'Let’s get you back on track', detail: failure },
  }
  const current = messages[activePhase]

  return (
    <main className={`auth-callback${!isError ? ' auth-callback--clean' : ''}`} aria-labelledby="callback-title">
      <div aria-hidden="true" className="auth-callback__ambient">
        <span className="auth-callback__orb auth-callback__orb--one" />
        <span className="auth-callback__orb auth-callback__orb--two" />
        <span className="auth-callback__grid" />
      </div>
      <header className="auth-callback__topbar">
        <Logo to="/" />
        <span className="auth-callback__secure"><ShieldCheck aria-hidden="true" weight="duotone" /> Secure account access</span>
      </header>

      <div className="auth-callback__layout">
        <section className="auth-callback__story">
          <p className="auth-callback__eyebrow">A better path to the right help</p>
          <h1>Good work starts with <span>trust.</span></h1>
          <p className="auth-callback__intro">Fixora brings people and skilled home-service professionals together through real work, useful details, and a clear next step.</p>
          <motion.div
            aria-hidden="true"
            className="auth-callback__illustration"
            initial={{ opacity: 0, y: reduceMotion ? 0 : shift.step, filter: reduceMotion ? 'blur(0px)' : `blur(${blur.surface})` }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={entranceTransition}
          >
            <div className="auth-callback__orbit auth-callback__orbit--outer" />
            <div className="auth-callback__orbit auth-callback__orbit--inner" />
            <div className="auth-callback__home-icon"><HouseLine weight="duotone" /></div>
            <div className="auth-callback__tool-icon"><Wrench weight="duotone" /></div>
            <div className="auth-callback__trust-chip"><CheckCircle weight="fill" /><span>Work you can see</span></div>
          </motion.div>
          <div className="auth-callback__story-note"><span className="auth-callback__note-line" />A clear path to skilled professionals.</div>
        </section>

        <section className="auth-callback__status" aria-live="polite">
          <div className="auth-callback__status-top">
            <span className={`auth-callback__status-icon${isError ? ' is-error' : activePhase === 'continue' ? ' is-success' : ''}`}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  aria-hidden="true"
                  key={activePhase === 'error' ? 'error' : activePhase === 'continue' ? 'ready' : 'working'}
                  initial={{ opacity: 0, scale: reduceMotion ? 1 : scale.icon }}
                  animate={{ opacity: 1, scale: 1, transition: swapTransition }}
                  exit={{ opacity: 0, scale: reduceMotion ? 1 : scale.icon, transition: swapTransition }}
                >
                  {isError ? <ArrowClockwise weight="bold" /> : activePhase === 'continue' ? <CheckCircle weight="fill" /> : <CircleNotch weight="bold" />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="auth-callback__status-label">{isError ? 'Action needed' : 'Account access'}</span>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={activePhase}
              className="auth-callback__status-copy"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8, filter: reduceMotion ? 'blur(0px)' : `blur(${blur.panel})` }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: swapTransition }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6, filter: reduceMotion ? 'blur(0px)' : `blur(${blur.panel})`, transition: swapTransition }}
            >
              <h2 id="callback-title">{current.title}</h2>
              <p>{current.detail}</p>
            </motion.div>
          </AnimatePresence>

          <div className={`auth-callback__steps${isError ? ' is-error' : ''}`} aria-label={`Authentication status: ${isError ? 'needs attention' : activePhase === 'verify' ? 'verifying' : activePhase === 'prepare' ? 'preparing your account' : 'ready'}`}>
            {['verify', 'prepare', 'continue'].map((step, index) => {
              const complete = ['verify', 'prepare', 'continue'].indexOf(phase) > index
              const currentStep = !isError && phase === step
              return <span className={`auth-callback__step${complete ? ' is-complete' : ''}${currentStep ? ' is-current' : ''}`} key={step} />
            })}
          </div>
          <p className="auth-callback__step-caption">{isError ? 'Your account remains protected' : activePhase === 'verify' ? 'Checking your secure link' : activePhase === 'prepare' ? 'Loading your Fixora profile' : 'Your destination is ready'}</p>

          {isError && (
            <div className="auth-callback__actions">
              {(sessionError || profileError || user) && <button className="auth-callback__retry" onClick={retry} type="button"><ArrowClockwise aria-hidden="true" />Try again</button>}
              <Link className="auth-callback__back" to="/auth/login"><ArrowLeft aria-hidden="true" />Return to sign in</Link>
            </div>
          )}
        </section>
      </div>

      <footer className="auth-callback__footer">
        <span>Fixora</span><span>Better home care, built on trust.</span>
      </footer>
    </main>
  )
}

export default function AuthCallbackPage() {
  return <ReducedMotionConfig><CallbackExperience /></ReducedMotionConfig>
}
