const SHELL_CACHE = 'fixora-shell-v6'
const ASSET_CACHE = 'fixora-assets-v6'
const APP_ROOT = new URL('./', self.registration.scope)
const APP_BASE_PATH = APP_ROOT.pathname
const appUrl = (path) => new URL(path, APP_ROOT).href
const MANIFEST_URL = appUrl('manifest.webmanifest')
const APP_SHELL = [
  APP_ROOT.href,
  MANIFEST_URL,
  appUrl('icons/fixora-192.png'),
  appUrl('icons/fixora-512.png'),
  appUrl('icons/fixora-maskable-512.png'),
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    const response = await fetch(APP_ROOT.href)
    const html = await response.clone().text()
    await cache.put(APP_ROOT.href, response)
    const shellAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => new URL(match[1], APP_ROOT))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith(`${APP_BASE_PATH}assets/`))
      .map((url) => url.href)
    await cache.addAll([...APP_SHELL.slice(1), ...shellAssets])
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('fixora-') && ![SHELL_CACHE, ASSET_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(async () => (await caches.match(APP_ROOT.href)) || Response.error()),
    )
    return
  }

  const isAppAsset = ['assets/', 'icons/'].some((path) => url.pathname.startsWith(`${APP_BASE_PATH}${path}`))
  if (!isAppAsset && url.pathname !== new URL(MANIFEST_URL).pathname) return

  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE)
    try {
      const response = await fetch(request)
      const contentType = response.headers.get('content-type') || ''
      if (isAppAsset && response.ok && response.type === 'basic' && !contentType.includes('text/html')) {
        await cache.put(request, response.clone())
      }
      // SPA rewrites can return index.html with status 200 for a missing lazy chunk.
      // Never hand that HTML to the JS module loader or save it under an asset URL.
      if (isAppAsset && contentType.includes('text/html')) throw new Error('Fixora asset URL returned the app shell.')
      return response
    } catch {
      const cached = await cache.match(request)
      if (cached) return cached
      throw new Error('This Fixora resource is not available offline.')
    }
  })())
})
