// TeeWager Service Worker
// Cache-first for the app shell; network-only for the course API.

const CACHE_NAME = 'teewager-v1';
const COURSE_API_ORIGIN = 'https://api.golfcourseapi.com';

// App-shell resources to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Remove any old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept course API calls — they need fresh data and auth headers
  if (url.origin === COURSE_API_ORIGIN) return;

  // Never intercept Stripe
  if (url.origin.includes('stripe.com')) return;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // For navigation requests (HTML pages) use network-first so deploys propagate
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // For everything else (JS, CSS, images, fonts): cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Only cache successful same-origin or CORS responses
        if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
