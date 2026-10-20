import { ArrowLeft, House } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/UiPrimitives.jsx'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return <main className="not-found-page">
    <Logo className="not-found-page__brand" to="/" />
    <section aria-labelledby="not-found-title">
      <span aria-hidden="true" className="not-found-page__code">404</span>
      <h1 id="not-found-title">This page isn’t here</h1>
      <p>The link may be out of date. Head back to Fixora and find what you need.</p>
      <Link to="/"><House aria-hidden="true" size={19} />Go to Fixora</Link>
    </section>
    <Link className="not-found-page__back" onClick={(event) => { if (window.history.length > 1) { event.preventDefault(); window.history.back() } }} to="/"><ArrowLeft aria-hidden="true" size={17} />Go back</Link>
  </main>
}
