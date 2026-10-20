import { supabase } from './supabase.js'
import { fetchProfilePhotoMap } from './profilePhotos.js'

export const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, created_at, read_at, reply_to_id, deleted_at, image_path'

export async function fetchMyConversations() {
  const { data, error } = await supabase.rpc('get_my_conversations')
  if (error) throw error
  const rows = data ?? []
  const photos = await fetchProfilePhotoMap(rows.map((row) => row.other_user_id))
  return rows.map((row) => ({ ...row, other_avatar_url: photos[row.other_user_id] ?? null }))
}

export async function fetchUnreadMessageCount() {
  const { data, error } = await supabase.rpc('get_my_unread_message_count')
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchConversationMessages(conversationId) {
  const { data, error } = await supabase.from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []).reverse()
}

export async function fetchEarlierMessages(conversationId, beforeMessage) {
  if (!beforeMessage) return []
  const { data, error } = await supabase.from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .lt('created_at', beforeMessage.created_at)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []).reverse()
}

export async function fetchMessageReactions(messageIds) {
  if (!messageIds.length) return []
  const { data, error } = await supabase.from('message_reactions')
    .select('message_id, user_id, emoji, created_at')
    .in('message_id', messageIds)
  if (error) throw error
  return data ?? []
}

export async function setMessageReaction(messageId, userId, emoji) {
  const { data: existing, error: readError } = await supabase.from('message_reactions')
    .select('message_id, user_id, emoji').eq('message_id', messageId).eq('user_id', userId).maybeSingle()
  if (readError) throw readError
  if (existing?.emoji === emoji) {
    const { error } = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase.from('message_reactions')
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' })
    .select('message_id, user_id, emoji, created_at').single()
  if (error) throw error
  return data
}

export async function unsendConversationMessage(messageId) {
  const { error } = await supabase.rpc('unsend_message', { requested_message_id: messageId })
  if (error) throw error
}

export async function sendConversationMessage(conversationId, senderId, body, { replyToId = null, imagePath = null } = {}) {
  const { data, error } = await supabase.from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body, reply_to_id: replyToId, image_path: imagePath })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function markConversationRead(conversationId) {
  const { error } = await supabase.rpc('mark_conversation_read', { requested_conversation_id: conversationId })
  if (error) throw error
}
