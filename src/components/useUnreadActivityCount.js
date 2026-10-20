import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function useUnreadActivityCount(userId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!userId || !supabase) { setCount(0); return undefined }
    let active = true
    let timer
    const refresh = async () => {
      const { count: nextCount, error } = await supabase.from('marketplace_activities').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null)
      if (!error && active) setCount(nextCount ?? 0)
    }
    void refresh()
    const channel = supabase.channel(`unread-activity-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_activities', filter: `recipient_id=eq.${userId}` }, () => { void refresh() }).subscribe((status) => {
      if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status) && !timer) timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 15000)
      if (!['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status) && timer) { clearInterval(timer); timer = null }
    })
    return () => { active = false; if (timer) clearInterval(timer); void supabase.removeChannel(channel) }
  }, [userId])
  return count
}
