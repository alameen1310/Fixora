import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from './ToastProvider.jsx'
import { ActionSheet, IconButton, ListRow } from './UiPrimitives.jsx'

export default function SignOutAction({ location = 'header' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  async function confirmSignOut() {
    setBusy(true)
    const { error } = await signOut()
    setBusy(false)
    if (error) {
      showToast({ type: 'error', message: 'We couldn’t sign you out. Please try again.' })
      return
    }
    setOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <>
      {location === 'header' ? (
        <IconButton className="fixora-app__signout" label="Sign out" onClick={() => setOpen(true)}><SignOut aria-hidden="true" size={19} /></IconButton>
      ) : (
        <ListRow destructive icon={SignOut} onClick={() => setOpen(true)}>Sign out</ListRow>
      )}
      <ActionSheet
        busy={busy}
        confirmLabel="Sign out"
        description="You can sign back in any time."
        onCancel={() => !busy && setOpen(false)}
        onConfirm={confirmSignOut}
        open={open}
        title="Sign out of Fixora?"
      />
    </>
  )
}
