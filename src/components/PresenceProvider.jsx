import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const PresenceContext = createContext(null)
const HEARTBEAT_MS = 60_000
const HIDDEN_GRACE_MS = 45_000

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const [onlineIds, setOnlineIds] = useState(() => new Set())
  const [lastSeenById, setLastSeenById] = useState({})
  const [showStatus, setShowStatusState] = useState(true)

  const refreshPresence = useCallback(async (ids) => {
    const requested = [...new Set((ids || []).filter(Boolean))]
    if (!requested.length) return
    const { data, error } = await supabase.from('user_presence').select('user_id, last_seen_at, show_status').in('user_id', requested)
    if (error) {
      if (import.meta.env.DEV) console.error('[presence-read]', { code: error.code, message: error.message })
      return
    }
    setLastSeenById((current) => {
      const next = { ...current }
      requested.forEach((userId) => { delete next[userId] })
      for (const row of data || []) {
        if (row.show_status) next[row.user_id] = row.last_seen_at
      }
      return next
    })
  }, [])

  const setShowStatus = useCallback(async (nextValue) => {
    if (!user?.id) return false
    const next = Boolean(nextValue)
    const now = new Date().toISOString()
    const { data: current, error: readError } = await supabase.from('user_presence').select('user_id').eq('user_id', user.id).maybeSingle()
    if (readError) throw readError
    const result = current
      ? await supabase.from('user_presence').update({ show_status: next, last_seen_at: now }).eq('user_id', user.id)
      : await supabase.from('user_presence').insert({ user_id: user.id, show_status: next, last_seen_at: now })
    if (result.error) throw result.error
    setShowStatusState(next)
    if (!next) setOnlineIds((ids) => { const copy = new Set(ids); copy.delete(user.id); return copy })
    return true
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !supabase) { setOnlineIds(new Set()); return undefined }
    let alive = true
    let channel
    let heartbeatTimer
    let untrackTimer
    let tracking = false

    async function writeHeartbeat(visiblePreference = showStatus) {
      if (!alive) return
      const now = new Date().toISOString()
      const { data: existing, error: readError } = await supabase.from('user_presence').select('user_id').eq('user_id', user.id).maybeSingle()
      if (readError) { if (import.meta.env.DEV) console.error('[presence-heartbeat-read]', { code: readError.code, message: readError.message }); return }
      const result = existing
        ? await supabase.from('user_presence').update({ last_seen_at: now, show_status: visiblePreference }).eq('user_id', user.id)
        : await supabase.from('user_presence').insert({ user_id: user.id, last_seen_at: now, show_status: visiblePreference })
      if (result.error && import.meta.env.DEV) console.error('[presence-heartbeat-write]', { code: result.error.code, message: result.error.message })
    }

    function track() {
      if (!channel || tracking || !showStatus) return
      tracking = true
      void channel.track({ user_id: user.id })
      void writeHeartbeat(true)
    }
    function untrack() {
      if (!channel || !tracking) return
      tracking = false
      void channel.untrack()
      setOnlineIds((ids) => { const copy = new Set(ids); copy.delete(user.id); return copy })
    }
    function onVisibility() {
      window.clearTimeout(untrackTimer)
      if (document.visibilityState === 'visible') {
        track()
        void writeHeartbeat(showStatus)
        window.clearInterval(heartbeatTimer)
        heartbeatTimer = window.setInterval(() => void writeHeartbeat(showStatus), HEARTBEAT_MS)
      } else {
        void writeHeartbeat(showStatus)
        untrackTimer = window.setTimeout(untrack, HIDDEN_GRACE_MS)
        window.clearInterval(heartbeatTimer)
      }
    }

    async function initialize() {
      const { data, error } = await supabase.from('user_presence').select('user_id, show_status').eq('user_id', user.id).maybeSingle()
      if (!alive) return
      if (error && import.meta.env.DEV) console.error('[presence-preference]', { code: error.code, message: error.message })
      const preference = data?.show_status ?? true
      setShowStatusState(preference)
      channel = supabase.channel('fixora-presence', { config: { presence: { key: user.id } } })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const ids = new Set(Object.values(state).flatMap((entries) => entries.map((entry) => entry.user_id).filter(Boolean)))
          setOnlineIds(ids)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && document.visibilityState === 'visible' && preference) {
            track()
            heartbeatTimer = window.setInterval(() => void writeHeartbeat(preference), HEARTBEAT_MS)
          }
        })
      document.addEventListener('visibilitychange', onVisibility)
    }

    void initialize()
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(heartbeatTimer)
      window.clearTimeout(untrackTimer)
      if (channel) void supabase.removeChannel(channel)
      setOnlineIds((ids) => { const copy = new Set(ids); copy.delete(user.id); return copy })
    }
  }, [user?.id, showStatus])

  const value = useMemo(() => ({
    isOnline: (userId) => Boolean(userId && onlineIds.has(userId)),
    lastSeen: (userId) => lastSeenById[userId] || null,
    refreshPresence,
    showStatus,
    setShowStatus,
  }), [onlineIds, lastSeenById, refreshPresence, showStatus, setShowStatus])
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence() {
  return useContext(PresenceContext) || { isOnline: () => false, lastSeen: () => null, refreshPresence: async () => {}, showStatus: true, setShowStatus: async () => false }
}
