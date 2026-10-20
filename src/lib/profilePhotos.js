import { supabase } from './supabase.js'

export function getProfilePhotoUrl(path) {
  if (!path || !supabase) return null
  return supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl
}

export async function fetchProfilePhotoMap(profileIds) {
  const ids = [...new Set((profileIds ?? []).filter(Boolean))]
  if (!ids.length) return {}
  const { data, error } = await supabase.rpc('get_profile_photo_cards', { requested_profile_ids: ids.slice(0, 100) })
  if (error) throw error
  return Object.fromEntries((data ?? []).map((row) => [row.profile_id, getProfilePhotoUrl(row.avatar_path)]))
}
