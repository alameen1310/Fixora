import { supabase } from './supabase.js'
import { publishedProviderSelection } from './providerQueries.js'

export async function fetchPostApplicationCount(postId) {
  const { count, error } = await supabase.from('problem_post_applications')
    .select('id', { count: 'exact', head: true }).eq('post_id', postId)
  if (error) throw error
  return count ?? 0
}

export async function fetchMyApplication(postId, professionalId) {
  const { data, error } = await supabase.from('problem_post_applications')
    .select('id, post_id, professional_id, message, status, created_at, updated_at')
    .eq('post_id', postId).eq('professional_id', professionalId).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPostApplications(postId) {
  const { data, error } = await supabase.from('problem_post_applications')
    .select('id, post_id, professional_id, message, status, created_at, updated_at')
    .eq('post_id', postId).order('created_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  const ids = [...new Set(rows.map((row) => row.professional_id))]
  if (!ids.length) return rows.map((application) => ({ ...application, professional: null }))

  const { data: providers, error: providerError } = await supabase.from('provider_profiles')
    .select(publishedProviderSelection).in('profile_id', ids).eq('is_published', true)
  if (providerError) throw providerError
  const providerById = Object.fromEntries((providers ?? []).map((provider) => [provider.profile_id, provider]))
  return rows.map((application) => ({ ...application, professional: providerById[application.professional_id] ?? null }))
}

export async function fetchMarketplaceActivities(userId) {
  const { data, error } = await supabase.from('marketplace_activities')
    .select('id, recipient_id, actor_id, kind, post_id, application_id, read_at, created_at, problem_posts(id, title, status), problem_post_applications(id, professional_id, status)')
    .eq('recipient_id', userId).order('created_at', { ascending: false }).limit(60)
  if (error) throw error
  const rows = data ?? []
  const providerIds = [...new Set(rows.filter((row) => row.kind === 'application_received').map((row) => row.actor_id).filter(Boolean))]
  if (!providerIds.length) return rows.map((row) => ({ ...row, actorName: null }))
  const { data: providers, error: providerError } = await supabase.from('provider_profiles')
    .select('profile_id, display_name').in('profile_id', providerIds).eq('is_published', true)
  if (providerError) throw providerError
  const names = Object.fromEntries((providers ?? []).map((provider) => [provider.profile_id, provider.display_name]))
  return rows.map((row) => ({ ...row, actorName: row.actor_id ? names[row.actor_id] ?? null : null }))
}

export async function markMarketplaceActivityRead(activityId, userId) {
  const { error } = await supabase.from('marketplace_activities')
    .update({ read_at: new Date().toISOString() }).eq('id', activityId).eq('recipient_id', userId).is('read_at', null)
  if (error) throw error
}
