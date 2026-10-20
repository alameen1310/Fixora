import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchUnreadMessageCount } from '../lib/chatQueries.js'

export default function useUnreadMessageCount(userId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId || !supabase) return undefined
    let active = true
    let polling = false
    let pollTimer
    const refresh = () => fetchUnreadMessageCount().then((value) => {
      if (active) setCount(value)
    }).catch(() => {})
    void refresh()
    const channel = supabase.channel(`unread-messages-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { void refresh() })
      .subscribe((status) => {
        polling = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'
        if (polling && !pollTimer) pollTimer = window.setInterval(() => { void refresh() }, 8000)
        if (!polling && pollTimer) {
          window.clearInterval(pollTimer)
          pollTimer = null
        }
      })
    return () => {
      active = false
      if (pollTimer) window.clearInterval(pollTimer)
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return count
}
