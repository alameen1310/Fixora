import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { MyPostsList } from '../components/PostsFeed.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import '../components/Posts.css'

export default function MyPostsPage() {
  const { user } = useAuth()
  return (
    <main className="app-page app-page--posts">
      <Link className="app-back-link post-detail__back" to="/app"><ArrowLeft aria-hidden="true" size={19} />Home</Link>
      <header className="app-page__heading">
        <h1 className="text-large-title">My Posts</h1>
        <p>Your published posts and their current status.</p>
      </header>
      <MyPostsList userId={user.id} />
    </main>
  )
}
