import { ClipboardText } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../components/UiPrimitives.jsx'
import './AuthenticatedPages.css'

export default function ActivityPage() {
  return (
    <main className="app-page">
      <header className="app-page__heading">
        <h1 className="text-large-title">Activity</h1>
        <p>Keep track of your household requests and completed work.</p>
      </header>

      <EmptyState
        icon={ClipboardText}
        message="Requests and jobs will appear here once they’re available."
        title="No activity yet"
        action={<Button as={Link} to="/app/discover" variant="secondary">Browse professionals</Button>}
      />
    </main>
  )
}
