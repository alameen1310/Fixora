import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from './ToastProvider.jsx'
import { useEffect } from 'react'

export default function PostRoleGuard({ children, customersOnly = false }) {
  const { profile } = useAuth()
  const location = useLocation()
  const { showToast } = useToast()
  const blocked = customersOnly && profile?.account_type !== 'customer'

  useEffect(() => {
    if (blocked) showToast({ type: 'info', message: location.pathname.endsWith('/applicants') ? 'Only the customer who created this post can review applicants.' : 'Only customers can create posts.' })
  }, [blocked, location.pathname, showToast])

  if (blocked) return <Navigate replace state={{ from: location.pathname }} to="/app" />
  return children
}
