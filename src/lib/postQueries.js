import { supabase } from './supabase.js'

export const POST_PAGE_SIZE = 10
export const POST_COLUMNS = 'id, author_id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, job_type, status, created_at, published_at, hired_at, service_categories(name, slug), problem_post_images(storage_path, sort_order)'
export const POST_DETAIL_COLUMNS = 'id, author_id, category_id, title, description, budget_type, budget_min_naira, budget_max_naira, negotiable, region, city, timing, target_date, job_type, status, created_at, published_at, closed_at, hired_professional_id, hired_at, service_categories(name, slug), problem_post_images(storage_path, sort_order)'


function applyCursor(query, cursor) {
  if (!cursor) return query
  const timestamp = `"${cursor.created_at}"`
  return query.or(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${cursor.id})`)
}

function postQuery({ categorySlug } = {}) {
  if (!supabase) throw new Error('Post services are unavailable.')
  return supabase.from('problem_posts')
    .select(categorySlug ? POST_COLUMNS.replace('service_categories(name, slug)', 'service_categories!inner(name, slug)') : POST_COLUMNS)
    .order('sort_order', { referencedTable: 'problem_post_images', ascending: true })
    .limit(1, { referencedTable: 'problem_post_images' })
}

function withCover(posts) {
  return (posts ?? []).map((post) => ({
    ...post,
    coverPath: [...(post.problem_post_images ?? [])]
      .sort((first, second) => first.sort_order - second.sort_order)[0]?.storage_path ?? null,
  }))
}

export async function fetchLatestOwnPost(userId) {
  const { data, error } = await postQuery()
    .eq('author_id', userId)
    .not('published_at', 'is', null)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw error
  return withCover(data)[0] ?? null
}

export async function fetchOtherOpenPosts(userId, { cursor, limit = POST_PAGE_SIZE, categorySlug } = {}) {
  let query = postQuery({ categorySlug })
    .eq('status', 'open')
    .not('published_at', 'is', null)
    .neq('author_id', userId)
  if (categorySlug) query = query.eq('service_categories.slug', categorySlug)
  query = applyCursor(query, cursor)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return withCover(data)
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
  const { data: authorRows, error: authorError } = await supabase.rpc('get_problem_post_author_cards', {
    requested_post_ids: [postId],
  })
  if (authorError) throw authorError
  return {
    ...data,
    images: [...(data.problem_post_images ?? [])].sort((first, second) => first.sort_order - second.sort_order),
    authorName: authorRows?.find((row) => row.post_id === postId)?.display_name ?? null,
  }
}

export async function fetchAuthorNames(posts) {
  const ids = [...new Set((posts ?? []).map(({ id }) => id).filter(Boolean))]
  if (!ids.length) return {}
  if (!supabase) throw new Error('Post services are unavailable.')
  const { data, error } = await supabase.rpc('get_problem_post_author_cards', { requested_post_ids: ids })
  if (error) throw error
  return Object.fromEntries((data ?? []).map(({ post_id, display_name }) => [post_id, display_name]))
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

function formatNaira(amount) {
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
