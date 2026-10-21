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
  const [{ data: ratings, error: ratingError }, { data: availabilityRows, error: availabilityError }] = await Promise.all([
    supabase.from('provider_rating_summary')
      .select('provider_id, review_count, average_rating').in('provider_id', ids),
    supabase.rpc('get_request_provider_availability', { requested_post_id: postId, requested_provider_ids: ids }),
  ])
  if (ratingError) throw ratingError
  if (availabilityError) throw availabilityError
  const providerById = Object.fromEntries((providers ?? []).map((provider) => [provider.profile_id, provider]))
  const ratingById = Object.fromEntries((ratings ?? []).map((rating) => [rating.provider_id, rating]))
  const availabilityById = Object.fromEntries((availabilityRows ?? []).map((row) => [row.provider_id, row.availability]))
  return rows.map((application) => ({ ...application, availability: availabilityById[application.professional_id] ?? (application.status === 'pending' ? 'unknown' : null), professional: providerById[application.professional_id] ? { ...providerById[application.professional_id], rating: ratingById[application.professional_id] ?? null } : null }))
}

export async function fetchMarketplaceActivities(userId) {
  const { data, error } = await supabase.from('marketplace_activities')
    .select('id, recipient_id, actor_id, kind, post_id, application_id, read_at, created_at, problem_posts(id, title, status, budget_type, budget_min_naira, budget_max_naira, negotiable, category_id, city, region, hired_professional_id, completed_at, final_price_naira, service_categories(name), problem_post_images(storage_path, sort_order, kind)), problem_post_applications(id, professional_id, message, status)')
    .eq('recipient_id', userId).order('created_at', { ascending: false }).limit(60)
  if (error) throw error
  const rows = data ?? []
  const providerIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))]
  const postIds = [...new Set(rows.map((row) => row.post_id).filter(Boolean))]
  const [{ data: providers, error: providerError }, { data: ratings, error: ratingError }, { data: completedJobs, error: jobsError }, { data: reviews, error: reviewsError }] = await Promise.all([
    providerIds.length ? supabase.from('provider_profiles').select('profile_id, display_name, avatar_path').in('profile_id', providerIds).eq('is_published', true) : Promise.resolve({ data: [], error: null }),
    providerIds.length ? supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').in('provider_id', providerIds) : Promise.resolve({ data: [], error: null }),
    providerIds.length ? supabase.from('problem_posts').select('hired_professional_id').eq('status', 'completed').in('hired_professional_id', providerIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from('job_reviews').select('post_id, rating').in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (providerError) throw providerError
  if (ratingError) throw ratingError
  if (jobsError) throw jobsError
  if (reviewsError) throw reviewsError
  const providerById = Object.fromEntries((providers ?? []).map((provider) => [provider.profile_id, provider]))
  const ratingById = Object.fromEntries((ratings ?? []).map((rating) => [rating.provider_id, rating]))
  const completedById = {}
  for (const post of completedJobs ?? []) completedById[post.hired_professional_id] = (completedById[post.hired_professional_id] || 0) + 1
  const reviewByPost = Object.fromEntries((reviews ?? []).map((review) => [review.post_id, review]))
  return rows.map((row) => {
    const post = row.problem_posts
    const coverPath = [...(post?.problem_post_images ?? []).filter((image) => image.kind === 'before')].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null
    const actor = row.actor_id ? providerById[row.actor_id] : null
    return { ...row, problem_posts: post ? { ...post, coverPath } : post, actorName: actor?.display_name ?? null, actorAvatarPath: actor?.avatar_path ?? null, actorRating: ratingById[row.actor_id] ?? null, actorCompletedJobs: completedById[row.actor_id] ?? 0, review: reviewByPost[row.post_id] ?? null }
  })
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
      .select('id, author_id, title, category_id, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, status, hired_professional_id, hired_at, created_at, service_categories(name), problem_post_images(storage_path, sort_order, kind)')
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
  const authorByPost = Object.fromEntries(nameRows.map((row) => [row.post_id, row]))
  const authorIds = [...new Set(nameRows.map(({ author_id }) => author_id).filter(Boolean))]
  const photoRows = []
  for (let index = 0; index < authorIds.length; index += 100) {
    const { data: photos, error: photosError } = await supabase.rpc('get_profile_photo_cards', { requested_profile_ids: authorIds.slice(index, index + 100) })
    if (photosError) throw photosError
    photoRows.push(...(photos ?? []))
  }
  const avatarByAuthor = Object.fromEntries(photoRows.map(({ profile_id, avatar_path }) => [profile_id, avatar_path]))
  return rows.map((application) => ({
    ...application,
    post: postById[application.post_id] ? { ...postById[application.post_id], coverPath: [...(postById[application.post_id].problem_post_images ?? []).filter((image) => image.kind === 'before')].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null } : null,
    customerName: authorByPost[application.post_id]?.display_name ?? 'Fixora customer',
    customerAvatarPath: avatarByAuthor[authorByPost[application.post_id]?.author_id] ?? null,
    activity: activityByApplication[application.id] ?? null,
  })).filter(({ post }) => post)
}

export async function markMarketplaceActivityRead(activityId, userId) {
  const { error } = await supabase.from('marketplace_activities')
    .update({ read_at: new Date().toISOString() }).eq('id', activityId).eq('recipient_id', userId).is('read_at', null)
  if (error) throw error
}

export async function markPostApplicationActivitiesRead(postId, userId) {
  const { error } = await supabase.from('marketplace_activities')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId).eq('post_id', postId).eq('kind', 'application_received').is('read_at', null)
  if (error) throw error
}
