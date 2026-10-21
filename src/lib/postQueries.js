import { supabase } from './supabase.js'

export const POST_PAGE_SIZE = 10
export const POST_COLUMNS = 'id, author_id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, schedule_mode, scheduled_start_at, scheduled_end_at, job_type, status, created_at, published_at, hired_professional_id, hired_at, completed_at, final_price_naira, service_categories(name, slug), problem_post_images(storage_path, sort_order, kind)'
export const POST_DETAIL_COLUMNS = 'id, author_id, category_id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, schedule_mode, scheduled_start_at, scheduled_end_at, job_type, status, created_at, published_at, closed_at, hired_professional_id, hired_at, completed_at, final_price_naira, service_categories(name, slug), problem_post_images(storage_path, sort_order, kind)'


function applyCursor(query, cursor) {
  if (!cursor) return query
  const timestamp = `"${cursor.created_at}"`
  return query.or(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${cursor.id})`)
}

function postQuery({ categorySlug, allImages = false } = {}) {
  if (!supabase) throw new Error('Post services are unavailable.')
  const query = supabase.from('problem_posts')
    .select(categorySlug ? POST_COLUMNS.replace('service_categories(name, slug)', 'service_categories!inner(name, slug)') : POST_COLUMNS)
    .order('sort_order', { referencedTable: 'problem_post_images', ascending: true })
  return allImages ? query : query.eq('problem_post_images.kind', 'before')
}

function withCover(posts) {
  return (posts ?? []).map((post) => ({
    ...post,
    coverPath: [...(post.problem_post_images ?? []).filter((image) => image.kind === 'before')]
      .sort((first, second) => first.sort_order - second.sort_order)[0]?.storage_path ?? null,
  }))
}

export async function fetchLatestOwnPost(userId, { categorySlug } = {}) {
  let query = postQuery({ categorySlug })
    .eq('author_id', userId)
    .not('published_at', 'is', null)
    .neq('status', 'removed')
  if (categorySlug) query = query.eq('service_categories.slug', categorySlug)
  const { data, error } = await query.order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw error
  return withCover(data)[0] ?? null
}

export async function fetchOpenPosts({ cursor, limit = POST_PAGE_SIZE, categorySlug } = {}) {
  let query = postQuery({ categorySlug })
    .eq('status', 'open')
    .not('published_at', 'is', null)
  if (categorySlug) query = query.eq('service_categories.slug', categorySlug)
  query = applyCursor(query, cursor)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return withCover(data)
}

export async function fetchCompletedPosts({ cursor, limit = POST_PAGE_SIZE } = {}) {
  let query = postQuery({ allImages: true }).eq('status', 'completed').not('published_at', 'is', null)
  if (cursor) {
    const timestamp = `"${cursor.completed_at}"`
    query = query.or(`completed_at.lt.${timestamp},and(completed_at.eq.${timestamp},id.lt.${cursor.id})`)
  }
  const { data, error } = await query.order('completed_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (error) throw error
  const posts = withCover(data)
  if (!posts.length) return posts
  const providerIds = [...new Set(posts.map(({ hired_professional_id }) => hired_professional_id).filter(Boolean))]
  const [providerResult, ratingResult] = await Promise.all([
    supabase.from('provider_profiles').select('profile_id, display_name, avatar_path, availability').in('profile_id', providerIds),
    supabase.from('provider_rating_summary').select('provider_id, review_count, average_rating').in('provider_id', providerIds),
  ])
  if (providerResult.error) throw providerResult.error
  if (ratingResult.error) throw ratingResult.error
  const providers = Object.fromEntries((providerResult.data ?? []).map((provider) => [provider.profile_id, provider]))
  const ratings = Object.fromEntries((ratingResult.data ?? []).map((summary) => [summary.provider_id, summary]))
  return posts.map((post) => ({ ...post, images: post.problem_post_images ?? [], provider: providers[post.hired_professional_id] ?? null, rating: ratings[post.hired_professional_id] ?? null }))
}

export function completedPostCursor(post) {
  return post ? { completed_at: post.completed_at, id: post.id } : null
}

export async function fetchMyPosts(userId, { cursor, limit = POST_PAGE_SIZE } = {}) {
  let query = postQuery()
    .eq('author_id', userId)
    .not('published_at', 'is', null)
    .neq('status', 'removed')
  query = applyCursor(query, cursor)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return withCover(data)
}

export async function fetchLatestMyPosts(userId, limit = 3) {
  const { data, error } = await postQuery()
    .eq('author_id', userId)
    .not('published_at', 'is', null)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return withCover(data)
}

export async function fetchProblemPost(postId) {
  if (!supabase) throw new Error('Post services are unavailable.')
  const { data, error } = await supabase
    .from('problem_posts')
    .select(POST_DETAIL_COLUMNS)
    .eq('id', postId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const authorRows = await fetchAuthorCards([{ id: postId }])
  const author = authorRows.find((row) => row.post_id === postId)
  return {
    ...data,
    images: [...(data.problem_post_images ?? [])].sort((first, second) => (first.kind === second.kind ? first.sort_order - second.sort_order : first.kind === 'before' ? -1 : 1)),
    authorName: author?.display_name ?? null,
    authorAvatarPath: author?.avatar_path ?? null,
  }
}

export async function fetchAuthorNames(posts) {
  const cards = await fetchAuthorCards(posts)
  return Object.fromEntries(cards.map(({ post_id, display_name }) => [post_id, display_name]))
}

export async function fetchAuthorCards(posts) {
  const ids = [...new Set((posts ?? []).map(({ id }) => id).filter(Boolean))]
  if (!ids.length) return []
  if (!supabase) throw new Error('Post services are unavailable.')
  const names = []
  for (let index = 0; index < ids.length; index += 20) {
    const { data, error } = await supabase.rpc('get_problem_post_author_cards', { requested_post_ids: ids.slice(index, index + 20) })
    if (error) throw error
    names.push(...(data ?? []))
  }
  const profileIds = [...new Set(names.map(({ author_id }) => author_id).filter(Boolean))]
  const photos = []
  for (let index = 0; index < profileIds.length; index += 100) {
    const { data, error } = await supabase.rpc('get_profile_photo_cards', { requested_profile_ids: profileIds.slice(index, index + 100) })
    if (error) throw error
    photos.push(...(data ?? []))
  }
  const avatarByProfile = Object.fromEntries(photos.map(({ profile_id, avatar_path }) => [profile_id, avatar_path]))
  return names.map((row) => ({ ...row, avatar_path: avatarByProfile[row.author_id] ?? null }))
}

export function postCursor(post) {
  return post ? { created_at: post.created_at, id: post.id } : null
}

export function formatPostBudget(post) {
  if (post.budget_type === 'open_to_quotes') return 'Open to quotes'
  if (post.budget_type === 'range') {
    return `${formatNaira(post.budget_min_naira)} – ${formatNaira(post.budget_max_naira)}`
  }
  if (post.negotiable) return `${formatNaira(post.budget_min_naira)} – Negotiable`
  return `${formatNaira(post.budget_min_naira)} – Fixed`
}

export function formatNaira(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(amount)
}

export function formatRelativeTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date(value))
}
