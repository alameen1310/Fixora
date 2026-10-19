export const homeFeedCache = new Map()
export const myPostsCache = new Map()

export function invalidatePostListCaches(userId) {
  for (const key of homeFeedCache.keys()) if (key.startsWith(`${userId}:`)) homeFeedCache.delete(key)
  myPostsCache.delete(userId)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fixora:post-created'))
}
