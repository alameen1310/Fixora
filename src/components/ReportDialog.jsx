import { useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from './UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from './ToastProvider.jsx'
import { useDismissable } from '../hooks/useDismissable.js'
import { supabase } from '../lib/supabase.js'
import './ReportDialog.css'

const reasons = ['Spam', 'Inappropriate', 'Scam', 'Other']

export default function ReportDialog({ open, onClose, targetType, targetId }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const boundaryRef = useRef(null)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  useDismissable({ boundaryRef, open, onDismiss: onClose })
  useEffect(() => { if (open) { setReason(''); setDetails('') } }, [open, targetId])
  if (!open) return null

  async function submit(event) {
    event.preventDefault()
    if (!reason || saving) return
    setSaving(true)
    const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details: details.trim() || null })
    setSaving(false)
    if (error) {
      console.error('[report-submit]', { targetType, code: error.code, message: error.message })
      showToast({ type: 'error', message: 'Your report could not be sent. Please try again.' })
      return
    }
    onClose()
    showToast({ type: 'success', message: 'Thanks. Your report was sent.' })
  }

  return <div className="report-dialog-backdrop" onClick={onClose}>
    <section aria-labelledby="report-dialog-title" aria-modal="true" className="report-dialog" onClick={(event) => event.stopPropagation()} ref={boundaryRef} role="dialog">
      <header><div><h2 id="report-dialog-title">Report this {targetType === 'user' ? 'profile' : targetType}</h2><p>Tell us what needs a closer look.</p></div><button aria-label="Close report form" onClick={onClose} type="button"><X size={19} /></button></header>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="report-reason">Reason</label>
        <select id="report-reason" onChange={(event) => setReason(event.target.value)} required value={reason}><option disabled value="">Choose a reason</option>{reasons.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <label htmlFor="report-details">Additional details <span>Optional</span></label>
        <textarea id="report-details" maxLength={500} onChange={(event) => setDetails(event.target.value)} placeholder="Share useful context. Please don’t include private contact details." rows={4} value={details} />
        <span className="report-dialog__counter">{details.length}/500</span>
        <Button disabled={!reason} loading={saving} type="submit">Send report</Button>
      </form>
    </section>
  </div>
}
