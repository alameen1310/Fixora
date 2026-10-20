import { supabase } from './supabase.js'

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, created_at, read_at'

export async function fetchMyConversations() {
  const { data, error } = await supabase.rpc('get_my_conversations')
  if (error) throw error
  return data ?? []
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
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function sendConversationMessage(conversationId, senderId, body) {
  const { data, error } = await supabase.from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function markConversationRead(conversationId, userId) {
  const { error } = await supabase.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null)
  if (error) throw error
}
