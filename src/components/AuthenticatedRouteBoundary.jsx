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
    console.error('[route-render]', error)
  }

  render() {
    if (this.state.failed) {
      return <main className="authenticated-route-error" role="alert">
        <span>We hit a snag</span>
        <h1>Something went wrong</h1>
        <p>This screen couldn’t load. Reload it or return home and try again.</p>
        <Link to="/app"><ArrowLeft aria-hidden="true" size={18} />Go home</Link>
        <button onClick={() => window.location.reload()} type="button"><ArrowClockwise aria-hidden="true" size={18} />Reload</button>
      </main>
    }
    return this.props.children
  }
}

export default RouteBoundary
