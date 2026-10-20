import { supabase } from './supabase.js'
import { publishedProviderSelection } from './providerQueries.js'
import { fetchProfilePhotoMap } from './profilePhotos.js'

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
  const { data: ratings, error: ratingError } = await supabase.from('provider_rating_summary')
    .select('provider_id, review_count, average_rating').in('provider_id', ids)
  if (ratingError) throw ratingError
  const photoById = await fetchProfilePhotoMap(ids)
  const providerById = Object.fromEntries((providers ?? []).map((provider) => [provider.profile_id, provider]))
  const ratingById = Object.fromEntries((ratings ?? []).map((rating) => [rating.provider_id, rating]))
  return rows.map((application) => ({ ...application, professional: providerById[application.professional_id] ? { ...providerById[application.professional_id], avatarUrl: photoById[application.professional_id] ?? null, rating: ratingById[application.professional_id] ?? null } : null }))
}

export async function fetchMarketplaceActivities(userId) {
  const { data, error } = await supabase.from('marketplace_activities')
    .select('id, recipient_id, actor_id, kind, post_id, application_id, read_at, created_at, problem_posts(id, title, status, region, city, budget_type, budget_min_naira, budget_max_naira, service_categories(name)), problem_post_applications(id, professional_id, status, message, created_at)')
    .eq('recipient_id', userId).order('created_at', { ascending: false }).limit(60)
  if (error) throw error
  const rows = data ?? []
  const providerIds = [...new Set(rows.filter((row) => row.kind === 'application_received').map((row) => row.actor_id).filter(Boolean))]
  if (!providerIds.length) return rows.map((row) => ({ ...row, actorName: null }))
  const { data: providers, error: providerError } = await supabase.from('provider_profiles')
    .select('profile_id, display_name, provider_type').in('profile_id', providerIds).eq('is_published', true)
  if (providerError) throw providerError
  const photoById = await fetchProfilePhotoMap(providerIds)
  const providersById = Object.fromEntries((providers ?? []).map((provider) => [provider.profile_id, provider]))
  return rows.map((row) => ({
    ...row,
    actorName: row.actor_id ? providersById[row.actor_id]?.display_name ?? null : null,
    actorType: row.actor_id ? providersById[row.actor_id]?.provider_type ?? null : null,
    actorPhotoUrl: row.actor_id ? photoById[row.actor_id] ?? null : null,
  }))
}

export async function fetchProviderApplications(userId) {
  const { data: applications, error } = await supabase.from('problem_post_applications')
    .select('id, post_id, professional_id, message, status, created_at, updated_at')
    .eq('professional_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  const rows = applications ?? []
  if (!rows.length) return []

  const postIds = [...new Set(rows.map(({ post_id }) => post_id))]
  const [{ data: posts, error: postsError }, { data: activities, error: activitiesError }] = await Promise.all([
    supabase.from('problem_posts')
      .select('id, title, category_id, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, status, hired_professional_id, hired_at, created_at, service_categories(name), problem_post_images(storage_path, sort_order, kind)')
      .in('id', postIds),
    supabase.from('marketplace_activities')
      .select('id, application_id, kind, read_at, created_at')
      .eq('recipient_id', userId).in('application_id', rows.map(({ id }) => id)),
  ])
  if (postsError) throw postsError
  if (activitiesError) throw activitiesError
  const postById = Object.fromEntries((posts ?? []).map((post) => [post.id, post]))
  const activityByApplication = Object.fromEntries((activities ?? []).map((activity) => [activity.application_id, activity]))
  const nameRows = []
  for (let index = 0; index < postIds.length; index += 20) {
    const { data: names, error: namesError } = await supabase.rpc('get_problem_post_author_cards', { requested_post_ids: postIds.slice(index, index + 20) })
    if (namesError) throw namesError
    nameRows.push(...(names ?? []))
  }
  const nameByPost = Object.fromEntries(nameRows.map((row) => [row.post_id, row.display_name]))
  const photoById = await fetchProfilePhotoMap(nameRows.map((row) => row.author_id))
  return rows.map((application) => ({
    ...application,
    post: postById[application.post_id] ? { ...postById[application.post_id], coverPath: [...(postById[application.post_id].problem_post_images ?? []).filter((image) => image.kind === 'before')].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null } : null,
    customerName: nameByPost[application.post_id] ?? 'Fixora customer',
    customerPhotoUrl: photoById[nameRows.find((row) => row.post_id === application.post_id)?.author_id] ?? null,
    activity: activityByApplication[application.id] ?? null,
  })).filter(({ post }) => post)
}

export async function markMarketplaceActivityRead(activityId, userId) {
  const { error } = await supabase.from('marketplace_activities')
    .update({ read_at: new Date().toISOString() }).eq('id', activityId).eq('recipient_id', userId).is('read_at', null)
  if (error) throw error
}
