const fs = require('fs');
const path = require('path');

/**
 * Generates a service-worker.js for a given site
 * File path: public/service-workers/<siteCode>/service-worker.js
 * Returns absolute path to the generated file.
 */
async function generateServiceWorker({ siteCode, siteIdentifier }) {
  const dir = path.join(__dirname, '..', 'public', 'service-workers', siteCode);
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'service-worker.js');

  const sw = `// Auto-generated service worker for ${siteCode} (${siteIdentifier})
// Generated: ${new Date().toISOString()}

const SITE_CODE = '${siteCode}';
const SITE_IDENTIFIER = '${siteIdentifier}';
const CACHE_NAME = \`\${SITE_CODE}-v1\`;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing for', SITE_CODE);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache opened');
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating for', SITE_CODE);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  let data = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
  };

  try {
    if (event.data) {
      const incoming = event.data.json();
      data = {
        ...data,
        ...incoming,
        url: incoming.data?.url || incoming.url || '/',
        notificationId: incoming.data?.notificationId || incoming.notificationId,
        userId: incoming.data?.userId || incoming.userId,
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    data.body = event.data ? event.data.text() : data.body;
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    image: data.image,
    tag: data.tag,
    renotify: !!data.tag,
    data: {
      url: data.url,
      notificationId: data.notificationId,
      userId: data.userId,
      siteIdentifier: SITE_IDENTIFIER,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

console.log('[SW] Service worker loaded for', SITE_CODE, SITE_IDENTIFIER);
`;

  await fs.promises.writeFile(filePath, sw, 'utf8');
  return filePath;
}

module.exports = { generateServiceWorker };
