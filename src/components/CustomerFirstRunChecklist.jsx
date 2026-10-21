import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle, UserCircle } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import './CustomerFirstRunChecklist.css'

export default function CustomerFirstRunChecklist() {
  const { profile, user } = useAuth()
  const key = `fixora.get-started-dismissed:${user.id}`
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  const [posts, setPosts] = useState([])
  const reload = useCallback(async () => {
    const { data } = await supabase.from('problem_posts').select('id, status, hired_professional_id').eq('author_id', user.id).order('created_at', { ascending: false }).limit(20)
    setPosts(data ?? [])
  }, [user.id])
  useEffect(() => { void reload(); window.addEventListener('fixora:home-refresh', reload); return () => window.removeEventListener('fixora:home-refresh', reload) }, [reload])

  const hasPost = posts.length > 0
  const hasHire = posts.some((post) => post.hired_professional_id)
  const allDone = Boolean(profile?.avatar_path && hasPost && hasHire)
  if (dismissed || allDone) return null
  const firstPost = posts[0]
  const steps = [
    { done: Boolean(profile?.avatar_path), label: 'Add a profile photo', to: '/app/profile/edit' },
    { done: hasPost, label: 'Post your first problem', to: '/app/posts/new' },
    { done: hasHire, label: 'Review applicants / Hire a professional', to: firstPost ? `/app/posts/${firstPost.id}/applicants` : '/app/posts/new' },
  ]
  return <section aria-label="Get started" className="first-run-checklist"><header><div><UserCircle aria-hidden="true" size={20} /><h2>Get started</h2></div><button onClick={() => { try { localStorage.setItem(key, '1') } catch { /* Browser storage may be unavailable. */ } setDismissed(true) }} type="button">Dismiss</button></header><ol>{steps.map((step) => <li className={step.done ? 'is-done' : ''} key={step.label}>{step.done ? <CheckCircle aria-hidden="true" size={19} weight="fill" /> : <span className="first-run-checklist__number" aria-hidden="true" /> }<Link to={step.to}>{step.label}<ArrowRight aria-hidden="true" size={15} /></Link></li>)}</ol></section>
}
