
const CACHE_NAME = 'ai-book-studio-v1.5.0'; // Bumped version
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/vendor/jspdf.umd.min.js',
  '/vendor/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://rsms.me/inter/inter.css',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/@google/genai@^1.13.0',
  'https://esm.sh/react-dom@^19.1.1/',
  'https://esm.sh/react@^19.1.1/',
  'https://esm.sh/react@^19.1.1',
  'https://esm.sh/@tiptap/core@^2.4.0',
  'https://esm.sh/@tiptap/extension-bubble-menu@^2.4.0',
  'https://esm.sh/@tiptap/extension-floating-menu@^2.4.0',
  'https://esm.sh/@tiptap/extension-image@^2.4.0',
  'https://esm.sh/@tiptap/extension-underline@^2.4.0',
  'https://esm.sh/@tiptap/extension-text-align@^2.4.0',
  'https://esm.sh/@tiptap/extension-subscript@^2.4.0',
  'https://esm.sh/@tiptap/extension-superscript@^2.4.0',
  'https://esm.sh/@tiptap/extension-table@^2.4.0',
  'https://esm.sh/@tiptap/extension-table-row@^2.4.0',
  'https://esm.sh/@tiptap/extension-table-cell@^2.4.0',
  'https://esm.sh/@tiptap/extension-table-header@^2.4.0',
  'https://esm.sh/@tiptap/extension-task-list@^2.4.0',
  'https://esm.sh/@tiptap/extension-task-item@^2.4.0',
  'https://esm.sh/@tiptap/extension-link@^2.4.0',
  'https://esm.sh/@tiptap/extension-text-style@^2.4.0',
  'https://esm.sh/@tiptap/extension-color@^2.4.0',
  'https://esm.sh/@tiptap/extension-highlight@^2.4.0',
  'https://esm.sh/@tiptap/react@^2.4.0',
  'https://esm.sh/@tiptap/starter-kit@^2.4.0',
  'https://esm.sh/react-router-dom@^6.25.1',
  'https://esm.sh/react-router@^6.25.1',
  'https://aistudiocdn.com/immer@^10.1.3',
  'https://esm.sh/marked@^13.0.1',
  'https://esm.sh/turndown@7.1.2',
  'https://esm.sh/pdfjs-dist@^4.4.178',
  'https://esm.sh/pdfjs-dist@^4.4.178/build/pdf.worker.mjs',
  'https://esm.sh/turndown-plugin-gfm@1.0.2'
];

// Install Event: Precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Is this a request for an external asset (JS, CSS, Font, Image)?
const isAssetRequest = (url) => {
  return (
    url.hostname.includes('esm.sh') || 
    url.hostname.includes('cdnjs.cloudflare.com') || 
    url.hostname.includes('fonts.googleapis.com') || 
    url.hostname.includes('fonts.gstatic.com') || 
    url.hostname.includes('rsms.me') || 
    url.hostname.includes('aistudiocdn.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg')
  );
};

self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests (POST, PUT, DELETE are network-only)
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Strategy 1: HTML Navigation -> Network First, Fallback to Cache (App Shell)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
             // Optional: Cache the fresh index.html if successful
             if (networkResponse.ok) {
                 cache.put('/index.html', networkResponse.clone());
             }
             return networkResponse;
          });
        })
        .catch(() => {
          // If offline, serve the cached index.html (App Shell)
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Strategy 2: External Assets & Local Static Files -> Cache First, Network Fallback
  // We aggressively cache libraries and fonts to speed up load and support offline.
  if (isAssetRequest(url) || url.origin === location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
            const networkResponse = await fetch(event.request);
            // Check valid response before caching
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
        } catch (error) {
            console.log('[Service Worker] Fetch failed for asset:', event.request.url);
            // For images, we could return a placeholder here if desired
            throw error;
        }
      })
    );
    return;
  }
  
  // Strategy 3: Default (Network Only) for everything else (APIs, etc.)
  // This ensures fresh data for API calls when online.
});