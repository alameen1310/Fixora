const SHELL_CACHE = 'fixora-shell-v1'
const ASSET_CACHE = 'fixora-assets-v1'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/fixora-192.png',
  '/icons/fixora-512.png',
  '/icons/fixora-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    const response = await fetch('/')
    const html = await response.clone().text()
    await cache.put('/', response)
    const shellAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
      .map((match) => match[1])
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
        .then(async (response) => {
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            await caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(async () => (await caches.match(request)) || caches.match('/')),
    )
    return
  }

  const isAppAsset = ['/assets/', '/icons/'].some((path) => url.pathname.startsWith(path))
  if (!isAppAsset && url.pathname !== '/manifest.webmanifest') return

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') cache.put(request, response.clone())
      return response
    }),
  )
})
