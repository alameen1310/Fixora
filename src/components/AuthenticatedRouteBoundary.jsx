import { Component } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowClockwise } from '@phosphor-icons/react'
import './AuthenticatedRouteBoundary.css'

function RouteBoundary({ children }) {
  const location = useLocation()
  return <AuthenticatedRouteErrorBoundary key={location.pathname}>{children}</AuthenticatedRouteErrorBoundary>
}

class AuthenticatedRouteErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('[authenticated-render]', { name: error?.name || 'Error' })
  }

  render() {
    if (this.state.failed) {
      return <main className="authenticated-route-error" role="alert">
        <span>We hit a snag</span>
        <h1>This screen couldn’t load</h1>
        <p>Your account is still signed in. Return home and try again.</p>
        <Link to="/app"><ArrowLeft aria-hidden="true" size={18} />Go to Home</Link>
        <button onClick={() => window.location.reload()} type="button"><ArrowClockwise aria-hidden="true" size={18} />Reload screen</button>
      </main>
    }
    return this.props.children
  }
}

export default RouteBoundary
