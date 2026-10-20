export const homeFeedCache = new Map()
export const myPostsCache = new Map()
export const appQueryCache = new Map()

export function clearUserAppState(userId) {
  for (const cache of [homeFeedCache, myPostsCache, appQueryCache]) {
    for (const key of cache.keys()) {
      if (String(key).startsWith(`${userId}:`) || String(key).includes(`:${userId}:`)) cache.delete(key)
    }
  }
  if (typeof window === 'undefined' || !userId) return
  try {
    window.localStorage.removeItem(`fixora-post-draft-${userId}`)
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('fixora.chatDraft.')) window.localStorage.removeItem(key)
    }
    for (const key of ['fixora.signupType', 'fixora.providerType', 'fixora.returnTo', 'fixora.redirectTo']) {
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // Private browsing modes can deny storage access; in-memory state is still cleared.
  }
}

export function invalidatePostListCaches(userId) {
  for (const key of homeFeedCache.keys()) if (key.startsWith(`${userId}:`)) homeFeedCache.delete(key)
  myPostsCache.delete(userId)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fixora:post-created'))
}
