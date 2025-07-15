const CACHE_NAME = 'phonebook-app-cache-v1';
const urlsToCache = [
    './', // Cache the root (index.html)
    './index.html',
    './manifest.json',
    './style.css', // Now caching the separate CSS file
    './script.js', // Now caching the separate JS file
    // Add other assets you want to cache here
    // For example, app icons:
    './icon-192x192.png',
    './icon-512x512.png',
    // Note: External CDNs like Tailwind CSS and Firebase SDK
    // are not directly cached here as they are hosted on other domains.
    // However, browsers typically have HTTP caching for these CDNs.
];

// Event: Install
// Triggered when the service worker is first installed.
// This is where we cache static assets.
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app files');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Failed to cache:', error);
            })
    );
});

// Event: Activate
// Triggered when the service worker is activated.
// This is where we clean up old caches.
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        })
    );
    // Claim clients immediately after activation
    return self.clients.claim();
});

// Event: Fetch
// Triggered every time the browser makes a network request.
// This is where we intercept requests and serve from cache if available.
self.addEventListener('fetch', event => {
    // Only handle navigation requests (e.g., when the user opens a new URL)
    // and requests for assets we explicitly cache.
    // Also, ensure we don't try to cache cross-origin requests like Firebase SDKs.
    const url = new URL(event.request.url);

    // Skip caching for cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle navigation requests and explicitly cached assets
    if (event.request.mode === 'navigate' || urlsToCache.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // If in cache, serve from cache
                    if (response) {
                        console.log('[Service Worker] Serving from cache:', event.request.url);
                        return response;
                    }
                    // If not in cache, fetch from network
                    console.log('[Service Worker] Fetching from network:', event.request.url);
                    return fetch(event.request);
                })
                .catch(error => {
                    console.error('[Service Worker] Fetch failed:', error);
                    // You could serve an offline page here if needed
                    // return caches.match('/offline.html');
                })
        );
    } else {
        // For other same-origin requests not explicitly cached, just fetch from network
        event.respondWith(fetch(event.request));
    }
});
                      
