import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowBendUpLeft, ArrowLeft, Camera, ChatCircleDots, Check, DotsThree, Flag, House, Info, PaperPlaneRight, Smiley, TrashSimple, WarningCircle, Wrench, X } from '@phosphor-icons/react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { Avatar, Button, Skeleton } from '../components/UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchConversationMessages, fetchEarlierMessages, fetchMessageReactions, fetchMyConversations, markConversationRead, sendConversationMessage, setMessageReaction, unsendConversationMessage } from '../lib/chatQueries.js'
import { formatRelativeTime } from '../lib/postQueries.js'
import { getPostImageUrl, preparePostPhoto } from '../lib/postImages.js'
import { supabase } from '../lib/supabase.js'
import { useDismissable } from '../hooks/useDismissable.js'
import { avatarUrl } from '../lib/avatarImages.js'
import { usePresence } from '../components/PresenceProvider.jsx'
import { appQueryCache } from '../lib/postListCache.js'
import appDoodles from '../assets/doodles/app-doodles.svg'
import ReportDialog from '../components/ReportDialog.jsx'
import usePullToRefresh from '../hooks/usePullToRefresh.jsx'
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

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const EMOJI_TRAY = '😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😇 🥰 😍 😘 😋 😎 🤔 🫡 🤗 🤝 🙏 👏 👍 👎 ❤️ 🧡 💛 💚 💙 💜 ✨ 🔥 🎉 💯 ✅ 🙌 💪 🤦 🤷 😭 😮 😴 ☀️ 🏠 🔧 🛠️ 📍'.split(' ')

function MessageList({ conversations, loading, error, onRetry, userId, isProvider, onlineUsers }) {
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const visible = conversations.filter((conversation) => {
    const needle = search.trim().toLowerCase()
    return (segment !== 'unread' || conversation.unread_count > 0)
      && (!needle || `${conversation.other_display_name} ${conversation.post_title}`.toLowerCase().includes(needle))
  })
  return (
    <aside aria-label="Conversations" className="messages-list-pane">
      <header className="messages-list__header"><div><h1>Messages</h1></div><ChatCircleDots aria-hidden="true" size={23} /></header>
      <label className="messages-list__search"><span className="visually-hidden">Search messages</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search people or jobs" value={search} />{search && <button aria-label="Clear search" onClick={() => setSearch('')} type="button"><X aria-hidden="true" size={17} /></button>}</label>
      <div aria-label="Filter messages" className="messages-list__segments" role="group"><button aria-pressed={segment === 'all'} onClick={() => setSegment('all')} type="button">All</button><button aria-pressed={segment === 'unread'} onClick={() => setSegment('unread')} type="button">Unread</button></div>
      {loading ? <div className="messages-list__skeletons" role="status" aria-label="Loading conversations">{[0, 1, 2].map((item) => <Skeleton className="messages-list__skeleton" key={item} />)}</div>
        : error ? <div className="messages-list__empty" role="alert"><WarningCircle aria-hidden="true" size={28} /><p>Messages couldn’t load.</p><Button onClick={onRetry} variant="secondary">Try again</Button></div>
          : visible.length === 0 ? <div className="messages-list__empty"><ChatCircleDots aria-hidden="true" size={30} /><p>{conversations.length ? 'No messages match your search.' : 'Messages appear once you hire or get hired.'}</p>{!conversations.length && <Link to={isProvider ? '/app/discover' : '/app/my-posts'}>{isProvider ? 'Find work' : 'My Posts'}</Link>}</div>
            : <nav aria-label="Your conversations" className="messages-list__items">{visible.map((conversation) => (
              <NavLink className={({ isActive }) => 'messages-list__item' + (isActive ? ' is-active' : '')} key={conversation.conversation_id} to={'/app/messages/' + conversation.conversation_id}>
                <span className="messages-list__avatar"><Avatar name={conversation.other_display_name} size={48} src={avatarUrl(conversation.other_avatar_path)} presence={onlineUsers?.has(conversation.other_user_id)} /></span>
                <span className="messages-list__copy"><span className="messages-list__item-top"><strong className={conversation.unread_count ? 'is-unread' : ''}>{conversation.other_display_name}</strong><time>{formatRelativeTime(conversation.last_message_at)}</time></span><span className="messages-list__preview">{conversation.last_sender_id === userId ? 'You: ' : ''}{conversation.last_message_preview}</span><span className="messages-list__post-chip">{conversation.post_title}</span></span>
                {conversation.unread_count > 0 && <span aria-label={conversation.unread_count + ' unread messages'} className="messages-list__unread">{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>}
              </NavLink>
            ))}</nav>}
    </aside>
  )
}

function MessagesWelcome() {
  const { conversations } = useOutletContext()
  if (!conversations.length) return null
  return <div className="messages-welcome">
    <div aria-hidden="true" className="messages-welcome__art"><span><Wrench size={27} weight="regular" /></span><span><House size={36} weight="regular" /></span></div>
    <div className="messages-welcome__copy"><span>FIXORA MESSAGES</span><h2>Good work starts with a conversation</h2><p>Select a conversation to coordinate details, timing and progress for a hired request.</p></div>
  </div>
}

function MessageGroup({ group, mine, userId, otherName, replies, reactions, onReply, onReact, onUnsend, onCopy, onMore, onImage, onQuote }) {
  const touchTimer = useRef(null)
  const touchStartX = useRef(null)
  const boundaryRef = useRef(null)
  const anyMenuOpen = group.items.some((message) => message.showMenu || message.showReactions)
  const closeMenus = useCallback(() => {
    group.items.forEach((message) => {
      if (message.showMenu || message.showReactions) onMore({ ...message, closeOnly: true })
    })
  }, [group.items, onMore])
  useDismissable({ boundaryRef, open: anyMenuOpen, onDismiss: closeMenus })
  return <div ref={boundaryRef} className={'message-group' + (mine ? ' is-mine' : '')}>
    {group.items.map((message) => {
      const grouped = Object.values((reactions ?? []).filter((reaction) => reaction.message_id === message.id).reduce((result, reaction) => { result[reaction.emoji] ??= { emoji: reaction.emoji, users: [] }; result[reaction.emoji].users.push(reaction.user_id); return result }, {}))
      const reply = replies.get(message.reply_to_id)
      return <div className={'message-bubble-wrap' + (message.showMenu ? ' is-menu-open' : '') + (message.showReactions ? ' is-reaction-open' : '') + (message.flash ? ' is-flashing' : '')} id={`message-${message.id}`} key={message.id} onContextMenu={(event) => { event.preventDefault(); onMore(message) }} onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX; touchTimer.current = setTimeout(() => onMore(message), 520) }} onTouchEnd={(event) => { clearTimeout(touchTimer.current); const delta = event.changedTouches[0]?.clientX - touchStartX.current; const target = event.currentTarget; if (delta >= 56) { target.classList.add('is-swipe-reply'); onReply(message); setTimeout(() => target.classList.remove('is-swipe-reply'), 220) } }}>
        <ArrowBendUpLeft aria-hidden="true" className="message-swipe-icon" size={18} />
        <div className="message-bubble-toolbar"><button aria-label="React to message" onClick={() => onReact(message)} type="button"><Smiley size={17} /></button><button aria-label="Reply to message" onClick={() => onReply(message)} type="button"><ArrowBendUpLeft size={17} /></button><button aria-label="More message actions" onClick={() => onMore(message)} type="button"><DotsThree size={19} /></button></div>
        <div className={'message-bubble' + (message.failed ? ' is-failed' : '') + (message.sending ? ' is-sending' : '') + (message.deleted_at ? ' is-deleted' : '')}>
          {message.deleted_at ? <em className="message-deleted"><TrashSimple aria-hidden="true" size={15} />{mine ? 'You deleted this message' : 'This message was deleted'}</em> : <>{reply && <button className="message-inline-reply" onClick={() => onQuote(reply.id)} type="button"><strong>{reply.sender_id === userId ? 'You' : otherName}</strong><span>{reply.deleted_at ? 'Message deleted' : reply.body || (reply.image_path ? 'Photo' : '')}</span></button>}{message.image_path && <button className="message-image-button" onClick={() => onImage(getPostImageUrl(message.image_path))} type="button"><img alt="Photo shared in chat" src={getPostImageUrl(message.image_path)} /></button>}{message.body && <span>{message.body}</span>}</>}
          {message.sending && <span className="message-bubble__state">Sending…</span>}{message.failed && <span className="message-bubble__state">Not sent. Retry</span>}
          {!message.deleted_at && <div aria-label="Message actions" className="message-bubble-menu" role="group"><div className="message-bubble-menu__reactions">{REACTIONS.map((emoji) => <button aria-label={`React with ${emoji}`} key={emoji} onClick={() => onReact(message, emoji)} type="button">{emoji}</button>)}</div><button onClick={() => onReply(message)} type="button">Reply</button><button onClick={() => onCopy(message)} type="button">Copy</button>{mine && <button onClick={() => onUnsend(message)} type="button">Delete</button>}</div>}
          {message.showReactions && <div className="message-reaction-picker">{REACTIONS.map((emoji) => <button aria-label={`React with ${emoji}`} key={emoji} onClick={() => onReact(message, emoji)} type="button">{emoji}</button>)}</div>}
        </div>
        {grouped.length > 0 && <div className="message-reactions">{grouped.map(({ emoji, users }) => <button aria-pressed={users.includes(userId)} key={emoji} onClick={() => onReact(message, emoji)} type="button">{emoji} {users.length}</button>)}</div>}
      </div>
    })}
    <time>{formatClock(group.items[group.items.length - 1].created_at)}{mine && (group.items.at(-1).read_at ? <span aria-label="Read" className="message-read-ticks is-read"><Check size={15} /><Check size={15} /></span> : <Check aria-label="Sent" className="message-read-tick" size={15} />)}</time>
  </div>
}

function ConversationThread() {
  const { conversationId } = useParams()
  const { conversations, loading: conversationsLoading, openDetails } = useOutletContext()
  const { isOnline } = usePresence()
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState([])
  const [jobEvents, setJobEvents] = useState([])
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [lightbox, setLightbox] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [error, setError] = useState('')
  const [newMessages, setNewMessages] = useState(0)
  const [polling, setPolling] = useState(false)
  const [typing, setTyping] = useState(false)
  const nearBottom = useRef(true)
  const scrollNode = useRef(null)
  const emojiBoundaryRef = useRef(null)
  const channelRef = useRef(null)
  const typingTimer = useRef(null)
  const remoteTypingTimer = useRef(null)
  const pendingUnread = useRef(null)
  const messageNodes = useRef(new Map())
  const messagesRef = useRef([])
  useDismissable({ boundaryRef: emojiBoundaryRef, open: emojiOpen, onDismiss: () => setEmojiOpen(false) })
  const isProvider = profile?.account_type === 'provider'
  const conversation = conversations.find((item) => item.conversation_id === conversationId)
  const online = conversation ? isOnline(conversation.other_user_id) : false
  const hasConversation = Boolean(conversation)
  const postHref = conversation ? '/app/posts/' + conversation.post_id : '/app/messages'
  useEffect(() => {
    setMessages([])
    setReplyTo(null)
    setPhoto(null)
    setEmojiOpen(false)
  }, [conversationId])
  const replyMap = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages])
  const draftKey = `fixora.chatDraft.${user.id}.${conversationId}`
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => {
    if (!conversation) return undefined
    let active = true
    async function loadJobEvents() {
      const [postResult, reviewResult, providerResult] = await Promise.all([
        supabase.from('problem_posts').select('id, title, status, hired_professional_id, hired_at, completed_at, final_price_naira').eq('id', conversation.post_id).maybeSingle(),
        supabase.from('job_reviews').select('id, rating, created_at').eq('post_id', conversation.post_id).maybeSingle(),
        supabase.from('provider_profiles').select('profile_id, display_name').eq('profile_id', conversation.provider_id).maybeSingle(),
      ])
      for (const result of [postResult, reviewResult, providerResult]) if (result.error) throw result.error
      const post = postResult.data
      if (!post || !active) return
      const items = []
      if (post.hired_at && post.hired_professional_id) items.push({ id: 'hired', kind: 'system', created_at: post.hired_at, text: `${providerResult.data?.display_name || 'The professional'} was hired for ${post.title}` })
      if (post.completed_at) items.push({ id: 'completed', kind: 'system', created_at: post.completed_at, text: `Job marked as completed${post.final_price_naira ? ` · ₦${Number(post.final_price_naira).toLocaleString('en-NG')}` : ''}` })
      if (reviewResult.data) items.push({ id: `review-${reviewResult.data.id}`, kind: 'system', created_at: reviewResult.data.created_at, text: `Review left · ${reviewResult.data.rating} ${reviewResult.data.rating === 1 ? 'star' : 'stars'}` })
      if (active) setJobEvents(items)
    }
    loadJobEvents().catch((eventError) => console.error('[chat-job-events]', { postId: conversation.post_id, code: eventError?.code, message: eventError?.message }))
    return () => { active = false }
  }, [conversation?.post_id, conversation?.provider_id])

  const load = useCallback(async () => {
    if (conversationsLoading || !hasConversation) return
    setLoading(true); setError('')
    try {
      const rows = await fetchConversationMessages(conversationId)
      const reactionRows = await fetchMessageReactions(rows.map(({ id }) => id))
      setMessages(rows); setReactions(reactionRows); setHasEarlier(rows.length === 30)
      pendingUnread.current = rows.find((message) => message.sender_id !== user.id && !message.read_at)?.id ?? null
      if (document.visibilityState === 'visible') await markConversationRead(conversationId)
    } catch (loadError) {
      console.error('[chat-load]', { conversationId, code: loadError?.code, message: loadError?.message })
      setError('This conversation couldn’t load. Check your connection and try again.')
    }
    finally { setLoading(false) }
  }, [conversationId, conversationsLoading, hasConversation, user.id])

  useEffect(() => { setDraft(window.localStorage.getItem(draftKey) || ''); setReplyTo(null); setPhoto(null); void load() }, [draftKey, load])
  useEffect(() => { window.localStorage.setItem(draftKey, draft) }, [draftKey, draft])
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible' && nearBottom.current && hasConversation) void markConversationRead(conversationId).catch(() => {}) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [conversationId, hasConversation])
  useEffect(() => {
    if (!scrollNode.current || loading) return
    if (pendingUnread.current) { messageNodes.current.get(pendingUnread.current)?.scrollIntoView({ block: 'start' }); pendingUnread.current = null }
    else if (nearBottom.current) scrollNode.current.scrollTop = scrollNode.current.scrollHeight
  }, [messages, loading])
  useEffect(() => () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); clearTimeout(typingTimer.current); clearTimeout(remoteTypingTimer.current) }, [photo])

  useEffect(() => {
    if (!supabase || !conversationId || conversationsLoading || !hasConversation) return undefined
    let active = true
    let timer
    setTyping(false)
    const channel = supabase.channel(`conversation-${conversationId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async ({ eventType, new: message }) => {
        if (!active) return
        if (eventType === 'INSERT') {
          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) return current
            const index = current.findIndex((item) => item.optimistic && item.sending && item.body === message.body && item.sender_id === message.sender_id)
            return index < 0 ? [...current, message] : [...current.slice(0, index), ...current.slice(index + 1), message]
          })
          if (message.sender_id !== user.id) {
            if (document.visibilityState === 'visible' && nearBottom.current) await markConversationRead(conversationId).catch(() => {})
            else setNewMessages((count) => count + 1)
          }
        } else if (eventType === 'UPDATE') setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...message } : item))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, ({ eventType, new: row, old }) => {
        const changed = row?.message_id ? row : old
        if (!changed || !messagesRef.current.some((message) => message.id === changed.message_id)) return
        setReactions((current) => {
          const without = current.filter((reaction) => !(reaction.message_id === changed.message_id && reaction.user_id === changed.user_id))
          return eventType === 'DELETE' ? without : [...without, row]
        })
      })
          .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.senderId !== user.id) { setTyping(true); clearTimeout(remoteTypingTimer.current); remoteTypingTimer.current = setTimeout(() => setTyping(false), 4000) }
      })
      .subscribe(async (status) => {
        const shouldPoll = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)
        setPolling(shouldPoll)
        if (shouldPoll && !timer) timer = window.setInterval(() => { void fetchConversationMessages(conversationId).then((rows) => setMessages((current) => [...rows, ...current.filter((message) => message.optimistic || message.failed)])).catch(() => {}) }, 8000)
        if (!shouldPoll && timer) { window.clearInterval(timer); timer = null }
      })
    channelRef.current = channel
    return () => { active = false; if (timer) window.clearInterval(timer); clearTimeout(remoteTypingTimer.current); void supabase.removeChannel(channel) }
  }, [conversationId, conversationsLoading, hasConversation, user.id])

  useEffect(() => { const textarea = document.querySelector('.messages-composer textarea'); if (textarea) { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 104) + 'px' } }, [draft])

  const groups = useMemo(() => {
    const result = []
    messages.forEach((message) => {
      const previous = result.at(-1)
      const last = previous?.items.at(-1)
      const same = previous && previous.senderId === message.sender_id && new Date(message.created_at).toDateString() === new Date(last.created_at).toDateString() && new Date(message.created_at) - new Date(last.created_at) < 5 * 60 * 1000
      if (same) previous.items.push(message)
      else result.push({ senderId: message.sender_id, day: new Date(message.created_at).toDateString(), items: [message] })
    })
    return result
  }, [messages])
  const timeline = useMemo(() => {
    const entries = [...groups.map((group) => ({ kind: 'messages', group, created_at: group.items[0].created_at, day: group.day })), ...jobEvents.map((event) => ({ ...event, day: new Date(event.created_at).toDateString() }))]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    let previousDay = ''
    return entries.map((entry) => {
      const day = entry.day || new Date(entry.created_at).toDateString()
      const withSeparator = { ...entry, dayLabel: day !== previousDay ? formatDay(entry.created_at) : '' }
      previousDay = day
      return withSeparator
    })
  }, [groups, jobEvents])

  function onScroll(event) {
    const node = event.currentTarget
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 100
    nearBottom.current = atBottom
    if (atBottom) { setNewMessages(0); if (document.visibilityState === 'visible') void markConversationRead(conversationId).catch(() => {}) }
  }
  async function loadEarlier() {
    const first = messages[0]
    if (!first) return
    const oldHeight = scrollNode.current?.scrollHeight || 0
    const earlier = await fetchEarlierMessages(conversationId, first)
    setHasEarlier(earlier.length === 30)
    setMessages((current) => [...earlier, ...current])
    requestAnimationFrame(() => { if (scrollNode.current) scrollNode.current.scrollTop += scrollNode.current.scrollHeight - oldHeight })
  }
  function onReply(message) { setReplyTo(message); setMessages((current) => current.map((item) => ({ ...item, showMenu: false, showReactions: false }))); document.querySelector('.messages-composer textarea')?.focus() }
  function onMore(message) { setMessages((current) => current.map((item) => ({ ...item, showMenu: !message.closeOnly && item.id === message.id ? !item.showMenu : false, showReactions: false }))) }
  async function onReact(message, emoji) {
    if (!emoji) { setMessages((current) => current.map((item) => ({ ...item, showReactions: item.id === message.id ? !item.showReactions : false }))); return }
    try {
      const saved = await setMessageReaction(message.id, user.id, emoji)
      setReactions((current) => [...current.filter((row) => !(row.message_id === message.id && row.user_id === user.id)), ...(saved ? [saved] : [])])
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, showMenu: false, showReactions: false } : item))
    } catch (reactionError) { console.error('[chat-reaction]', { code: reactionError.code, message: reactionError.message }) }
  }
  async function onUnsend(message) {
    try { await unsendConversationMessage(message.id); setMessages((current) => current.map((item) => item.id === message.id ? { ...item, deleted_at: new Date().toISOString(), showMenu: false, showReactions: false } : item)) }
    catch (unsendError) { console.error('[chat-unsend]', { code: unsendError.code, message: unsendError.message }) }
  }
  async function onCopy(message) { const value = message.body || (message.image_path ? 'Photo' : 'Message deleted'); try { await navigator.clipboard.writeText(value) } catch { /* clipboard access is browser controlled */ } setMessages((current) => current.map((item) => ({ ...item, showMenu: false }))) }
  function onQuote(messageId) { const node = messageNodes.current.get(messageId); node?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); node?.classList.add('is-flashing'); setTimeout(() => node?.classList.remove('is-flashing'), 950) }
  async function choosePhoto(file) {
    if (!file) return
    setPhotoBusy(true)
    try { const prepared = await preparePostPhoto(file); if (photo?.preview) URL.revokeObjectURL(photo.preview); setPhoto({ file: prepared, preview: URL.createObjectURL(prepared) }) }
    catch (photoError) {
      console.error('[chat-photo-prepare]', { conversationId, code: photoError?.code, message: photoError?.message })
      setError('This photo couldn’t be prepared. Choose another image and try again.')
    }
    finally { setPhotoBusy(false) }
  }
  async function send(text = draft, retryMessage = null) {
    const body = text.trim()
    const file = retryMessage?.file || photo?.file
    if ((!body && !file && !retryMessage?.image_path) || body.length > 2000 || conversation.post_status === 'removed') return
    const optimisticId = retryMessage?.id || `local-${crypto.randomUUID()}`
    const replyId = retryMessage?.reply_to_id || replyTo?.id || null
    const existingPath = retryMessage?.image_path || null
    setDraft(''); setReplyTo(null); setPhoto(null); nearBottom.current = true
    setMessages((current) => retryMessage
      ? current.map((message) => message.id === optimisticId ? { ...message, sending: true, failed: false } : message)
      : [...current, { id: optimisticId, conversation_id: conversationId, sender_id: user.id, body, reply_to_id: replyId, image_path: existingPath, created_at: new Date().toISOString(), sending: true, optimistic: true }])
    let imagePath = existingPath
    let uploadComplete = Boolean(retryMessage?.uploadComplete)
    try {
      if (file && !uploadComplete) {
        imagePath ||= `${user.id}/chat/${conversationId}/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage.from('problem-post-photos').upload(imagePath, file, { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
        uploadComplete = true
      }
      const saved = await sendConversationMessage(conversationId, user.id, body, { replyToId: replyId, imagePath })
      setMessages((current) => [...current.filter((message) => message.id !== optimisticId && message.id !== saved.id), saved])
    } catch (sendError) {
      console.error('[chat-write]', { step: imagePath ? 'send-photo-message' : 'send-message', conversationId, code: sendError.code, message: sendError.message })
      setMessages((current) => current.map((message) => message.id === optimisticId ? { ...message, sending: false, failed: true, image_path: imagePath, file, uploadComplete, reply_to_id: replyId } : message))
    }
  }
  function handleKeyDown(event) { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { event.preventDefault(); void send() } }
  function handleDraftChange(value) { setDraft(value); if (channelRef.current) { void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { senderId: user.id } }); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => { setTyping(false) }, 900) } }

  if (!conversation) return conversationsLoading ? <div className="messages-welcome" role="status"><Skeleton style={{ width: '72%', height: 48 }} /><Skeleton style={{ width: '56%', height: 48 }} /></div> : <div className="messages-welcome" role="status"><p>This conversation is unavailable.</p><Button as={Link} to="/app/messages" variant="secondary">Back to messages</Button></div>

  const quickReplies = isProvider ? ['Hello, I’m ready to start', 'What time works for you?', 'Thanks for choosing me'] : ['Hi, when can you start?', 'Can you share your quote?', 'Thanks for applying']
  return <section aria-label={'Conversation with ' + conversation.other_display_name} className="messages-thread">
    <header className="messages-thread__header"><Link aria-label="Back to messages" className="messages-thread__back" to="/app/messages"><ArrowLeft aria-hidden="true" size={21} /></Link><span className={'messages-thread__avatar' + (online ? ' is-online' : '')}><Avatar name={conversation.other_display_name} size={40} src={avatarUrl(conversation.other_avatar_path)} presence={online} /></span><div className="messages-thread__identity"><strong>{conversation.other_display_name}</strong><span>{typing ? 'Typing…' : online ? 'Online' : conversation.post_title}</span></div><div className="messages-thread__actions"><Button className="messages-thread__view-job" as={Link} to={postHref} variant="secondary">View job</Button><Button aria-label="Conversation details" className="messages-thread__details" onClick={openDetails} variant="ghost"><Info aria-hidden="true" size={19} /></Button><details className="messages-thread__overflow"><summary aria-label="More conversation actions"><DotsThree aria-hidden="true" size={21} /></summary><div><Link to={postHref}>View job</Link><button onClick={openDetails} type="button">Details</button>{!isProvider && <Link to={`/app/professionals/${conversation.other_user_id}`}>View profile</Link>}<button onClick={() => setReportOpen(true)} type="button"><Flag aria-hidden="true" size={15} />Report</button></div></details></div></header>
    <div className="messages-job-context"><span className="messages-job-context__image">{conversation.cover_path ? <img alt="" src={getPostImageUrl(conversation.cover_path)} /> : <Wrench aria-hidden="true" size={20} />}</span><div><strong>{conversation.post_title}</strong><span>{conversation.post_status === 'completed' ? 'Completed' : conversation.post_status === 'closed' ? 'In progress' : 'Request'}</span></div>{!isProvider && conversation.post_status === 'closed' ? <Button as={Link} to={`${postHref}/complete`} variant="primary">Mark as completed</Button> : <Button as={Link} to={postHref} variant="secondary">View request</Button>}</div>
    {error ? <div className="messages-thread__error" role="alert"><p>Messages couldn’t load.</p><Button onClick={() => void load()} variant="secondary">Retry</Button></div> : <>
      <div aria-live="polite" className="messages-thread__scroll" onScroll={onScroll} ref={scrollNode} style={{ '--chat-wallpaper': `url("${appDoodles}")` }}>
        {loading && <div className="messages-thread__skeletons" role="status" aria-label="Loading messages"><Skeleton /><Skeleton /><Skeleton /></div>}
        {!loading && hasEarlier && <button className="messages-load-earlier" onClick={() => void loadEarlier()} type="button">Load earlier messages</button>}
        {!loading && messages.length === 0 && <div className="messages-thread__first"><p>Say hello to {conversation.other_display_name.split(' ')[0]}. You’re both on {conversation.post_title}.</p><div>{quickReplies.map((reply) => <button key={reply} onClick={() => setDraft(reply)} type="button">{reply}</button>)}</div></div>}
        {timeline.map((entry) => entry.kind === 'system'
          ? <div className="messages-day-group" key={entry.id}>{entry.dayLabel && <time className="messages-day-separator">{entry.dayLabel}</time>}<p className="messages-system-event">{entry.text}</p></div>
          : <div className="messages-day-group" key={entry.group.day + '-' + entry.group.items[0].id}>{entry.dayLabel && <time className="messages-day-separator">{entry.dayLabel}</time>}{entry.group.items.some((item) => item.id === pendingUnread.current) && <div className="messages-unread-divider">Unread messages</div>}<div ref={(node) => entry.group.items.forEach((item) => node && messageNodes.current.set(item.id, node))}><MessageGroup group={entry.group} mine={entry.group.senderId === user.id} otherName={conversation.other_display_name} onCopy={onCopy} onImage={setLightbox} onMore={onMore} onQuote={onQuote} onReact={onReact} onReply={onReply} onUnsend={onUnsend} reactions={reactions} replies={replyMap} userId={user.id} /></div>{entry.group.items.some((item) => item.failed) && <div className="message-retry-row"><span>Not sent.</span><button onClick={() => { const failed = entry.group.items.find((item) => item.failed); void send(failed.body, failed) }} type="button">Retry</button></div>}</div>)}
        {typing && <div aria-label="Typing" className="messages-typing"><i /><i /><i /></div>}{polling && <span className="messages-thread__quiet-status">Reconnecting…</span>}
      </div>
      {newMessages > 0 && <button className="messages-new-pill" onClick={() => { if (scrollNode.current) scrollNode.current.scrollTop = scrollNode.current.scrollHeight; nearBottom.current = true; setNewMessages(0); void markConversationRead(conversationId).catch(() => {}) }} type="button">{newMessages > 1 ? `${newMessages} new messages` : 'New messages'}</button>}
      <form className="messages-composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
        {replyTo && <div className="messages-composer__reply"><div><strong>Replying to {replyTo.sender_id === user.id ? 'yourself' : conversation.other_display_name}</strong><span>{replyTo.deleted_at ? 'Message deleted' : replyTo.body || (replyTo.image_path ? 'Photo' : '')}</span></div><button aria-label="Cancel reply" onClick={() => setReplyTo(null)} type="button"><X size={18} /></button></div>}
        {photo && <div className="messages-composer__photo"><img alt="Photo preview" src={photo.preview} /><span>Ready to send</span><button aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(photo.preview); setPhoto(null) }} type="button"><X size={18} /></button></div>}
        <div className="messages-composer__tools" ref={emojiBoundaryRef}><button aria-label="Attach an image" onClick={() => document.getElementById('chat-photo')?.click()} type="button"><Camera size={20} /></button><button aria-label="Choose emoji" onClick={() => setEmojiOpen((open) => !open)} type="button"><Smiley size={20} /></button>{emojiOpen && <div className="messages-emoji-tray">{EMOJI_TRAY.map((emoji, index) => <button key={`${emoji}-${index}`} onClick={() => setDraft((value) => value + emoji)} type="button">{emoji}</button>)}</div>}<input accept="image/*" hidden id="chat-photo" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = '' }} type="file" /><span>{photoBusy ? 'Preparing photo…' : ''}</span></div>
        <textarea aria-label="Write a message" maxLength={2000} onBlur={() => window.scrollTo(0, 0)} onChange={(event) => handleDraftChange(event.target.value)} onFocus={() => window.scrollTo(0, 0)} onKeyDown={handleKeyDown} onPaste={(event) => { const image = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith('image/')); if (image) { event.preventDefault(); void choosePhoto(image.getAsFile()) } }} placeholder={conversation.post_status === 'removed' ? 'Messaging is unavailable for this request' : 'Write a message…'} readOnly={conversation.post_status === 'removed'} rows={1} value={draft} />
        <button aria-label="Send message" className="messages-composer__send" disabled={(!draft.trim() && !photo) || photoBusy || conversation.post_status === 'removed'} type="submit"><PaperPlaneRight aria-hidden="true" size={21} weight="fill" /></button>
      </form>
    </>}
    {lightbox && <button aria-label="Close image" className="messages-lightbox" onClick={() => setLightbox('')} type="button"><img alt="Photo shared in chat" src={lightbox} /><span>Close</span></button>}
    <ReportDialog onClose={() => setReportOpen(false)} open={reportOpen} targetId={conversation.other_user_id} targetType="user" />
  </section>
}

export function MessagesLayout() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cacheKey = `${user?.id}:messages:list`
  const cached = appQueryCache.get(cacheKey)
  const [conversations, setConversations] = useState(() => cached?.conversations ?? [])
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState(false)
  const [polling, setPolling] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const lastRefreshAt = useRef(cached?.lastRefreshAt || 0)
  const { isOnline, refreshPresence } = usePresence()
  const onlineUsers = useMemo(() => new Set(conversations.filter((conversation) => isOnline(conversation.other_user_id)).map((conversation) => conversation.other_user_id)), [conversations, isOnline])
  const threadOpen = location.pathname !== '/app/messages' && location.pathname !== '/app/messages/'
  const selectedConversation = conversations.find((item) => item.conversation_id === location.pathname.split('/').at(-1))

  const reload = useCallback(async ({ silent = false } = {}) => {
    try {
      const rows = await fetchMyConversations()
      setConversations(rows)
      lastRefreshAt.current = Date.now()
      appQueryCache.set(cacheKey, { conversations: rows, lastRefreshAt: lastRefreshAt.current })
      setError(false)
      return rows
    } catch (loadError) {
      console.error('[chat-read]', { step: 'load-conversations', code: loadError.code, message: loadError.message })
      setError(true)
      return []
    } finally { if (!silent) setLoading(false); else setLoading(false) }
  }, [cacheKey])
  const pullRefresh = usePullToRefresh(() => reload({ silent: true }))

  useEffect(() => { if (!cached) void reload(); else if (Date.now() - lastRefreshAt.current >= 60_000) void reload({ silent: true }) }, [cacheKey, cached, reload])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && Date.now() - lastRefreshAt.current >= 60_000) void reload({ silent: true }) }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [reload])
  useEffect(() => { void refreshPresence(conversations.map((conversation) => conversation.other_user_id)) }, [conversations, refreshPresence])

  useEffect(() => {
    if (!user?.id || !supabase) return undefined
    let timer
    const channel = supabase.channel('conversation-list-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, ({ eventType, new: message }) => {
        if (eventType === 'UPDATE' && message.deleted_at) { void reload(); return }
        setConversations((current) => {
          const updated = current.map((row) => {
          if (row.conversation_id !== message.conversation_id) return row
          if (eventType === 'INSERT') return {
            ...row,
            last_message_preview: message.deleted_at ? 'Message deleted' : message.image_path ? 'Photo' : message.body,
            last_sender_id: message.sender_id,
            last_message_at: message.created_at,
            unread_count: row.unread_count + (message.sender_id === user.id ? 0 : 1),
          }
          if (eventType === 'UPDATE' && message.read_at && message.sender_id !== user.id) return { ...row, unread_count: Math.max(0, row.unread_count - 1) }
          return row
          }).sort((left, right) => new Date(right.last_message_at) - new Date(left.last_message_at))
          appQueryCache.set(cacheKey, { conversations: updated, lastRefreshAt: lastRefreshAt.current })
          return updated
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, ({ new: row }) => {
        if (row.customer_id === user.id || row.provider_id === user.id) void reload()
      })
      .subscribe((status) => {
        const shouldPoll = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)
        setPolling(shouldPoll)
      if (shouldPoll && !timer) timer = window.setInterval(() => { void reload({ silent: true }) }, 8000)
        if (!shouldPoll && timer) { window.clearInterval(timer); timer = null }
      })
    return () => { if (timer) window.clearInterval(timer); void supabase.removeChannel(channel) }
  }, [cacheKey, user?.id, reload])

  useEffect(() => {
    const postId = searchParams.get('postId')
    if (!postId || loading) return
    const target = conversations.find((item) => item.post_id === postId)
    if (target) navigate('/app/messages/' + target.conversation_id, { replace: true })
    else navigate('/app/messages', { replace: true })
  }, [conversations, loading, navigate, searchParams])

  const openDetails = useCallback(() => setDetailsOpen(true), [])
  const closeDetails = useCallback(() => setDetailsOpen(false), [])
  useEffect(() => { setDetailsOpen(false) }, [location.pathname])
  const context = useMemo(() => ({ conversations, loading, reload, openDetails }), [conversations, loading, openDetails, reload])
  return <main className={'messages-shell' + (threadOpen ? ' is-thread-open' : '') + (selectedConversation ? ' has-selection' : '') + (polling ? ' is-polling' : '')} ref={pullRefresh.containerRef}>
    {pullRefresh.indicator}
    <MessageList conversations={conversations} error={error} isProvider={profile?.account_type === 'provider'} loading={loading} onRetry={() => void reload()} onlineUsers={onlineUsers} userId={user.id} />
    <section className="messages-main" style={{ '--chat-wallpaper': `url("${appDoodles}")` }}><Outlet context={context} /></section>
    {detailsOpen && selectedConversation && <MessageInfoPane conversation={selectedConversation} isProvider={profile?.account_type === 'provider'} onClose={closeDetails} />}
  </main>
}

function MessageInfoPane({ conversation, isProvider, onClose }) {
  const [photos, setPhotos] = useState([])
  const [preview, setPreview] = useState('')
  const [providerSummary, setProviderSummary] = useState(null)
  const { isOnline } = usePresence()
  const boundaryRef = useRef(null)
  useDismissable({ boundaryRef, open: true, onDismiss: onClose })
  useEffect(() => {
    let active = true
    supabase.from('messages').select('id, image_path, created_at').eq('conversation_id', conversation.conversation_id).not('image_path', 'is', null).order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => { if (active) setPhotos(data ?? []) })
    return () => { active = false }
  }, [conversation.conversation_id])
  useEffect(() => {
    if (isProvider) return undefined
    let active = true
    Promise.all([
      supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').eq('provider_id', conversation.other_user_id).maybeSingle(),
      supabase.from('problem_posts').select('id', { count: 'exact', head: true }).eq('hired_professional_id', conversation.other_user_id).eq('status', 'completed'),
    ]).then(([ratingResult, jobsResult]) => {
      if (ratingResult.error) throw ratingResult.error
      if (jobsResult.error) throw jobsResult.error
      if (active) setProviderSummary({ rating: ratingResult.data, jobs: jobsResult.count ?? 0 })
    }).catch((error) => console.error('[chat-details]', { code: error?.code, message: error?.message }))
    return () => { active = false }
  }, [conversation.other_user_id, isProvider])
  return <><button aria-label="Close conversation details" className="messages-details-backdrop" onClick={onClose} tabIndex={-1} type="button" /><aside aria-label="Conversation details" className="messages-info-pane" ref={boundaryRef}>
    <header className="messages-info-pane__header"><h2>Details</h2><button aria-label="Close details" onClick={onClose} type="button"><X size={20} /></button></header>
    <div className="messages-info-pane__person"><Avatar name={conversation.other_display_name} size={96} src={avatarUrl(conversation.other_avatar_path)} presence={isOnline(conversation.other_user_id)} /><strong>{conversation.other_display_name}</strong>{isOnline(conversation.other_user_id) ? <span className="messages-info-pane__online">Online</span> : <span className="messages-info-pane__online">{conversation.post_title}</span>}{!isProvider && <><span className="messages-info-pane__stats">{providerSummary?.rating?.review_count ? `${Number(providerSummary.rating.average_rating).toFixed(1)} · ${providerSummary.rating.review_count} reviews` : 'No reviews yet'} · {providerSummary?.jobs ?? 0} jobs completed</span><Link to={`/app/professionals/${conversation.other_user_id}`}>View profile</Link></>}</div>
      <section><h2>Job</h2><Link className="messages-info-pane__job" to={`/app/posts/${conversation.post_id}`}>{conversation.cover_path && <img alt="" src={getPostImageUrl(conversation.cover_path)} />}<strong>{conversation.post_title}</strong><span>{conversation.post_status === 'completed' ? 'Completed' : conversation.post_status === 'closed' ? 'In progress' : 'Request'}</span></Link>{!isProvider && conversation.post_status === 'closed' && <Button as={Link} to={`/app/posts/${conversation.post_id}/complete`} variant="primary">Mark as completed</Button>}</section>
    <section><h2>Shared photos</h2>{photos.length ? <div className="messages-info-pane__photos">{photos.map((photo) => <button aria-label="View shared photo" key={photo.id} onClick={() => setPreview(getPostImageUrl(photo.image_path))} type="button"><img alt="Shared in conversation" src={getPostImageUrl(photo.image_path)} /></button>)}</div> : <p className="messages-info-pane__empty">No shared photos yet.</p>}</section>
    {preview && <button aria-label="Close photo" className="messages-lightbox" onClick={() => setPreview('')} type="button"><img alt="Shared in conversation" src={preview} /><span>Close</span></button>}
  </aside></>
}

export function MessagesHome() { return <MessagesWelcome /> }
export { ConversationThread }
