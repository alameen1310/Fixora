import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChatCircleDots, PaperPlaneRight, WarningCircle } from '@phosphor-icons/react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { Avatar, Button, Skeleton } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchConversationMessages, fetchMyConversations, markConversationRead, sendConversationMessage } from '../lib/chatQueries.js'
import { formatRelativeTime } from '../lib/postQueries.js'
import { supabase } from '../lib/supabase.js'
import './MessagesPage.css'

function formatClock(value) {
  return new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatDay(value) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(date)
}

function MessageList({ conversations, loading, error, onRetry }) {
  return (
    <aside aria-label="Conversations" className="messages-list-pane">
      <header className="messages-list__header"><div><span className="messages-eyebrow">Your conversations</span><h1>Messages</h1></div><ChatCircleDots aria-hidden="true" size={25} /></header>
      {loading ? <div className="messages-list__skeletons" role="status" aria-label="Loading conversations">{[0, 1, 2].map((item) => <Skeleton className="messages-list__skeleton" key={item} />)}</div>
        : error ? <div className="messages-list__empty" role="alert"><WarningCircle aria-hidden="true" size={28} /><p>Messages couldn’t load.</p><Button onClick={onRetry} variant="secondary">Try again</Button></div>
          : conversations.length === 0 ? <div className="messages-list__empty"><ChatCircleDots aria-hidden="true" size={30} /><p>Messages appear here once you hire or get hired.</p></div>
            : <nav aria-label="Your conversations" className="messages-list__items">{conversations.map((conversation) => (
              <NavLink className={({ isActive }) => 'messages-list__item' + (isActive ? ' is-active' : '')} key={conversation.conversation_id} to={'/app/messages/' + conversation.conversation_id}>
                <Avatar name={conversation.other_display_name} size={46} />
                <span className="messages-list__copy"><span className="messages-list__item-top"><strong>{conversation.other_display_name}</strong><time>{formatRelativeTime(conversation.last_message_at)}</time></span><span className="messages-list__post-chip">{conversation.post_title}</span><span className="messages-list__preview">{conversation.last_message_preview}</span></span>
                {conversation.unread_count > 0 && <span aria-label={conversation.unread_count + ' unread messages'} className="messages-list__unread">{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>}
              </NavLink>
            ))}</nav>}
    </aside>
  )
}

function MessagesWelcome() {
  const { conversations } = useOutletContext()
  if (!conversations.length) return null
  return <div className="messages-welcome"><ChatCircleDots aria-hidden="true" size={38} /><h2>Select a conversation</h2><p>Your messages about a hired request will appear here.</p></div>
}

function MessageGroup({ group, mine }) {
  return <div className={'message-group' + (mine ? ' is-mine' : '')}>
    {group.items.map((message) => <p className={'message-bubble' + (message.failed ? ' is-failed' : '')} key={message.id}>{message.body}{message.sending && <span className="message-bubble__state">Sending…</span>}{message.failed && <span className="message-bubble__state">Not sent</span>}</p>)}
    <time>{formatClock(group.items[group.items.length - 1].created_at)}</time>
  </div>
}

function ConversationThread() {
  const { conversationId } = useParams()
  const { conversations, loading: conversationsLoading } = useOutletContext()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMessages, setNewMessages] = useState(false)
  const [polling, setPolling] = useState(false)
  const nearBottom = useRef(true)
  const scrollNode = useRef(null)
  const conversation = conversations.find((item) => item.conversation_id === conversationId)
  const hasConversation = Boolean(conversation)
  const postHref = conversation ? '/app/posts/' + conversation.post_id : '/app/messages'

  const load = useCallback(async () => {
    if (conversationsLoading || !hasConversation) return
    setLoading(true)
    setError('')
    try {
      const rows = await fetchConversationMessages(conversationId)
      setMessages(rows)
      if (document.visibilityState === 'visible') {
        await markConversationRead(conversationId, user.id)
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load this conversation.')
    } finally {
      setLoading(false)
    }
  }, [conversationId, conversationsLoading, hasConversation, user.id])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (nearBottom.current && scrollNode.current) scrollNode.current.scrollTop = scrollNode.current.scrollHeight
  }, [messages, loading])

  useEffect(() => {
    if (!supabase || !conversationId || conversationsLoading || !hasConversation) return undefined
    let active = true
    let timer
    const channel = supabase.channel('conversation-' + conversationId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, async ({ new: message }) => {
        if (!active) return
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current
          const optimisticIndex = current.findIndex((item) => item.optimistic && item.sending
            && item.body === message.body && item.sender_id === message.sender_id)
          return optimisticIndex < 0
            ? [...current, message]
            : [...current.slice(0, optimisticIndex), ...current.slice(optimisticIndex + 1), message]
        })
        if (message.sender_id !== user.id) {
          const visible = document.visibilityState === 'visible'
          const scroll = document.querySelector('.messages-thread__scroll')
          const closeToBottom = scroll && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120
          if (visible && (nearBottom.current || closeToBottom)) {
            await markConversationRead(conversationId, user.id).catch(() => {})
          } else setNewMessages(true)
        }
      })
      .subscribe((status) => {
        const shouldPoll = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)
        setPolling(shouldPoll)
        if (shouldPoll && !timer) timer = window.setInterval(() => {
          void fetchConversationMessages(conversationId).then((rows) => setMessages((current) => [
            ...rows,
            ...current.filter((message) => message.optimistic || message.failed),
          ])).then(() => {
            if (document.visibilityState === 'visible') return markConversationRead(conversationId, user.id).catch(() => {})
            return undefined
          }).catch(() => {})
        }, 8000)
        if (!shouldPoll && timer) { window.clearInterval(timer); timer = null }
      })
    return () => {
      active = false
      if (timer) window.clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [conversationId, conversationsLoading, hasConversation, load, user.id])

  useEffect(() => {
    const textarea = document.querySelector('.messages-composer textarea')
    if (textarea) { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 104) + 'px' }
  }, [draft])

  const groups = useMemo(() => {
    const result = []
    messages.forEach((message) => {
      const previous = result[result.length - 1]
      const last = previous?.items[previous.items.length - 1]
      const sameGroup = previous && previous.senderId === message.sender_id
        && new Date(message.created_at).toDateString() === new Date(last.created_at).toDateString()
        && new Date(message.created_at) - new Date(last.created_at) < 5 * 60 * 1000
      if (sameGroup) previous.items.push(message)
      else result.push({ senderId: message.sender_id, day: new Date(message.created_at).toDateString(), items: [message] })
    })
    return result
  }, [messages])

  function onScroll(event) {
    const node = event.currentTarget
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120
    const wasNearBottom = nearBottom.current
    nearBottom.current = atBottom
    if (atBottom) {
      setNewMessages(false)
      if (!wasNearBottom && document.visibilityState === 'visible') void markConversationRead(conversationId, user.id).catch(() => {})
    }
  }

  async function send(text = draft, retryId = null) {
    const body = text.trim()
    if (!body || body.length > 2000) return
    const optimisticId = retryId || 'local-' + crypto.randomUUID()
    setDraft('')
    nearBottom.current = true
    setMessages((current) => retryId
      ? current.map((message) => message.id === retryId ? { ...message, sending: true, failed: false } : message)
      : [...current, { id: optimisticId, conversation_id: conversationId, sender_id: user.id, body, created_at: new Date().toISOString(), sending: true, optimistic: true }])
    try {
      const saved = await sendConversationMessage(conversationId, user.id, body)
      setMessages((current) => [...current.filter((message) => message.id !== optimisticId && message.id !== saved.id), saved])
    } catch (sendError) {
      console.error('[chat-write]', { step: 'send-message', conversationId, code: sendError.code, message: sendError.message })
      setMessages((current) => current.map((message) => message.id === optimisticId ? { ...message, sending: false, failed: true } : message))
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  if (!conversation) return conversationsLoading
    ? <div className="messages-welcome" role="status"><Skeleton style={{ width: '72%', height: 48 }} /><Skeleton style={{ width: '56%', height: 48 }} /></div>
    : <div className="messages-welcome" role="status"><p>This conversation is unavailable.</p><Button as={Link} to="/app/messages" variant="secondary">Back to messages</Button></div>

  return <section aria-label={'Conversation with ' + conversation.other_display_name} className="messages-thread">
    <header className="messages-thread__header">
      <Link aria-label="Back to messages" className="messages-thread__back" to="/app/messages"><ArrowLeft aria-hidden="true" size={21} /></Link>
      <Avatar name={conversation.other_display_name} size={42} />
      <div><strong>{conversation.other_display_name}</strong><Link to={postHref}>{conversation.post_title}</Link></div>
    </header>
    {error ? <div className="messages-thread__error" role="alert"><p>Messages couldn’t load.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></div> : <>
      <div aria-live="polite" className="messages-thread__scroll" onScroll={onScroll} ref={scrollNode}>
        {loading && <div className="messages-thread__skeletons" role="status" aria-label="Loading messages"><Skeleton /><Skeleton /><Skeleton /></div>}
        {!loading && messages.length === 0 && <p className="messages-thread__first">You’re chatting about <Link to={postHref}>{conversation.post_title}</Link>. Say hello.</p>}
        {groups.map((group, index) => <div className="messages-day-group" key={group.day + '-' + group.items[0].id}>
          {(index === 0 || groups[index - 1].day !== group.day) && <time className="messages-day-separator">{formatDay(group.items[0].created_at)}</time>}
          <MessageGroup group={group} mine={group.senderId === user.id} />
          {group.items.some((item) => item.failed) && <div className="message-retry-row"><span>Message not sent.</span><button onClick={() => { const failed = group.items.find((item) => item.failed); void send(failed.body, failed.id) }} type="button">Retry</button></div>}
        </div>)}
        {polling && <span className="messages-thread__quiet-status">Reconnecting…</span>}
      </div>
      {newMessages && <button className="messages-new-pill" onClick={() => { if (scrollNode.current) scrollNode.current.scrollTop = scrollNode.current.scrollHeight; nearBottom.current = true; setNewMessages(false); void markConversationRead(conversationId, user.id).catch(() => {}) }} type="button">New messages</button>}
      <form className="messages-composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <textarea aria-label="Write a message" maxLength={2000} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Write a message…" rows={1} value={draft} />
        <button aria-label="Send message" className="messages-composer__send" disabled={!draft.trim()} type="submit"><PaperPlaneRight aria-hidden="true" size={21} weight="fill" /></button>
      </form>
    </>}
  </section>
}

export function MessagesLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [polling, setPolling] = useState(false)
  const threadOpen = location.pathname !== '/app/messages' && location.pathname !== '/app/messages/'

  const reload = useCallback(async () => {
    try {
      const rows = await fetchMyConversations()
      setConversations(rows)
      setError(false)
      return rows
    } catch (loadError) {
      console.error('[chat-read]', { step: 'load-conversations', code: loadError.code, message: loadError.message })
      setError(true)
      return []
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!user?.id || !supabase) return undefined
    let timer
    const channel = supabase.channel('conversation-list-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, ({ eventType, new: message }) => {
        setConversations((current) => current.map((row) => {
          if (row.conversation_id !== message.conversation_id) return row
          if (eventType === 'INSERT') return {
            ...row,
            last_message_preview: message.body,
            last_message_at: message.created_at,
            unread_count: row.unread_count + (message.sender_id === user.id ? 0 : 1),
          }
          if (eventType === 'UPDATE' && message.read_at && message.sender_id !== user.id) return { ...row, unread_count: Math.max(0, row.unread_count - 1) }
          return row
        }).sort((left, right) => new Date(right.last_message_at) - new Date(left.last_message_at)))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, ({ new: row }) => {
        if (row.customer_id === user.id || row.provider_id === user.id) void reload()
      })
      .subscribe((status) => {
        const shouldPoll = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)
        setPolling(shouldPoll)
        if (shouldPoll && !timer) timer = window.setInterval(() => { void reload() }, 8000)
        if (!shouldPoll && timer) { window.clearInterval(timer); timer = null }
      })
    return () => { if (timer) window.clearInterval(timer); void supabase.removeChannel(channel) }
  }, [user?.id, reload])

  useEffect(() => {
    const postId = searchParams.get('postId')
    if (!postId || loading) return
    const target = conversations.find((item) => item.post_id === postId)
    if (target) navigate('/app/messages/' + target.conversation_id, { replace: true })
    else navigate('/app/messages', { replace: true })
  }, [conversations, loading, navigate, searchParams])

  const context = useMemo(() => ({ conversations, loading, reload }), [conversations, loading, reload])
  return <main className={'messages-shell' + (threadOpen ? ' is-thread-open' : '') + (polling ? ' is-polling' : '')}>
    <MessageList conversations={conversations} error={error} loading={loading} onRetry={() => void reload()} />
    <section className="messages-main"><Outlet context={context} /></section>
  </main>
}

export function MessagesHome() { return <MessagesWelcome /> }
export { ConversationThread }
