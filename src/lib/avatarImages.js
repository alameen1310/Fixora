import { supabase } from './supabase.js'

export function avatarUrl(path) {
  if (!path || !supabase) return ''
  const bucket = /\/avatar-[^/]+\.jpg$/i.test(path) ? 'avatars' : 'profile-photos'
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl || ''
}

export function avatarBucket(path) {
  return /\/avatar-[^/]+\.jpg$/i.test(path || '') ? 'avatars' : 'profile-photos'
}
