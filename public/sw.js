self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/assets/favicon.png',
    data: {
      url: data.url || '/',
      notification_id: data.notification_id || null,
      site_identifier: data.site_identifier || null,
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const d = event.notification.data || {};
  const targetUrl = d.url || '/';
  event.waitUntil(clients.openWindow(targetUrl));
  // Optionally send engagement back to server
  if (d.notification_id && d.site_identifier) {
    fetch('/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification_id: d.notification_id,
        event_type: 'click',
        site_identifier: d.site_identifier,
      })
    }).catch(() => {});
  }
});
