// ===================================================================
// CORRECTED SERVICE WORKER EXAMPLE FOR CLIENT SITES
// ===================================================================
// This service worker should be deployed on your client site domain
// (e.g., styles.solutiosoftware.com)
//
// IMPORTANT: Replace configuration values at the top with your actual values
// ===================================================================

// ============ CONFIGURATION - UPDATE THESE VALUES ============
const SITE_CODE = 'styles'; // Your site code from the notification system
const SITE_IDENTIFIER = 'styles.solutiosoftware.com'; // Your site identifier
const NOTIFICATION_SERVER = 'https://app1.icecodelab.app'; // Your notification server URL
const API_KEY = 'your-api-key-here'; // Your API key for tracking endpoints
// =============================================================

const CACHE_NAME = `${SITE_CODE}-v1`;

// Install event - create cache and add initial resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache opened');
      // Optionally pre-cache critical assets here:
      // return cache.addAll(['/offline.html', '/icon.png']);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
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
    }).then(() => {
      return self.clients.claim(); // Take control of all pages
    })
  );
});

// Fetch event - serve from cache or network (optional caching strategy)
self.addEventListener('fetch', (event) => {
  // Network-first strategy for API calls, cache-first for assets
  const url = new URL(event.request.url);
  
  if (url.origin === location.origin) {
    // Cache-first for same-origin resources
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }
        
        return fetch(event.request).then((response) => {
          // Cache successful responses
          if (response && response.status === 200) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
              return response;
            });
          }
          return response;
        });
      })
    );
  }
});

// ============ PUSH NOTIFICATION HANDLING ============

// Default notification configuration
function getDefaultNotificationData() {
  return {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    image: undefined,
    tag: undefined,
    silent: false,
    url: '/',
    notificationId: null,
    userId: null,
  };
}

// Send analytics to notification server
async function sendAnalyticsEvent(notificationId, siteIdentifier, userId, eventType) {
  if (!notificationId) {
    console.warn('[SW] No notificationId, skipping analytics');
    return;
  }

  const analyticsUrl = `${NOTIFICATION_SERVER}/track-event`;
  
  try {
    const response = await fetch(analyticsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY, // Required for API authentication
      },
      body: JSON.stringify({
        notificationId: notificationId,
        siteIdentifier: siteIdentifier,
        userId: userId,
        eventType: eventType, // 'open', 'click', 'close', etc.
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[SW] Analytics event sent:', eventType, data);
    } else {
      console.error('[SW] Analytics request failed:', response.status);
    }
  } catch (error) {
    console.error('[SW] Error sending analytics event:', error);
  }
}

// Push event - handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('[SW] Push event received');
  
  const defaultData = getDefaultNotificationData();
  let notificationData = { ...defaultData };

  // Parse incoming push data
  if (event.data) {
    try {
      const incomingData = event.data.json();
      console.log('[SW] Push data:', incomingData);

      // Merge with defaults
      notificationData = {
        ...defaultData,
        ...incomingData,
        // Handle nested data object
        url: incomingData.data?.url || incomingData.url || defaultData.url,
        notificationId: incomingData.data?.notificationId || incomingData.notificationId || defaultData.notificationId,
        userId: incomingData.data?.userId || incomingData.userId || defaultData.userId,
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      notificationData.body = event.data.text();
    }
  }

  // Notification options (only valid Notification API properties)
  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    image: notificationData.image,
    tag: notificationData.tag,
    silent: notificationData.silent,
    requireInteraction: false,
    // Store custom data in the data property
    data: {
      url: notificationData.url,
      notificationId: notificationData.notificationId,
      userId: notificationData.userId,
      siteIdentifier: SITE_IDENTIFIER,
    },
  };

  // Show notification and send 'open' analytics
  event.waitUntil(
    self.registration
      .showNotification(notificationData.title, notificationOptions)
      .then(() => {
        console.log('[SW] Notification shown');
        // Send analytics event for notification display (open)
        return sendAnalyticsEvent(
          notificationData.notificationId,
          SITE_IDENTIFIER,
          notificationData.userId,
          'open'
        );
      })
      .catch((err) => {
        console.error('[SW] Error showing notification:', err);
      })
  );
});

// Notification click event - handle user clicking on notification
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const notificationData = event.notification.data || {};
  const notificationId = notificationData.notificationId;
  const siteIdentifier = notificationData.siteIdentifier || SITE_IDENTIFIER;
  const userId = notificationData.userId;
  const targetUrl = notificationData.url || '/';

  console.log('[SW] Click data:', { notificationId, siteIdentifier, userId, targetUrl });

  // Send click analytics
  const analyticsPromise = sendAnalyticsEvent(
    notificationId,
    siteIdentifier,
    userId,
    'click'
  );

  // Handle action buttons (if any were defined)
  if (event.action) {
    console.log('[SW] Action clicked:', event.action);
    // Handle specific actions
    switch (event.action) {
      case 'like':
        console.log('[SW] Like action');
        break;
      case 'reply':
        console.log('[SW] Reply action');
        break;
      default:
        console.log('[SW] Unknown action:', event.action);
    }
  }

  // Open or focus the target URL
  const navigationPromise = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Check if there's already a window open with this URL
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
    .catch((err) => {
      console.error('[SW] Error opening window:', err);
    });

  // Wait for both analytics and navigation to complete
  event.waitUntil(Promise.all([analyticsPromise, navigationPromise]));
});

// Optional: Handle notification close events (not widely supported)
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed without interaction');
  const notificationData = event.notification.data || {};
  
  // Optionally track close events
  event.waitUntil(
    sendAnalyticsEvent(
      notificationData.notificationId,
      notificationData.siteIdentifier || SITE_IDENTIFIER,
      notificationData.userId,
      'close'
    )
  );
});

// Message handler - for communication with pages
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Respond to ping messages
  if (event.data === 'PING') {
    event.ports[0].postMessage('PONG');
  }
});

console.log('[SW] Service worker script loaded for', SITE_CODE);
