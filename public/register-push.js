(async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // Wait until ready
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      showToast('Notification permission denied', true);
      return;
    }
    // Fetch public VAPID key from server config if exposed; else embed from env
    // For now, assume server injects `window.PUBLIC_VAPID_KEY` in views if needed
    const vapidKey = window.PUBLIC_VAPID_KEY;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    // Determine site_identifier from a meta tag or global; fallback empty
    const siteIdentifier = (document.querySelector('meta[name="site-identifier"]')||{}).content || '';
    const resp = await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.toJSON().keys,
        domain: location.hostname,
        site_identifier: siteIdentifier
      })
    });
    if (resp.ok) {
      console.log('Subscribed to push');
      showToast('Subscribed to push successfully');
    } else {
      const txt = await resp.text().catch(()=> '');
      console.error('Subscription failed', resp.status, txt);
      showToast('Subscription failed: ' + (txt || resp.statusText), true);
    }
  } catch (e) {
    console.error('Push registration failed', e);
    showToast('Push registration error: ' + e.message, true);
  }
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  function showToast(message, isError){
    var el = document.createElement('div');
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.bottom = '16px';
    el.style.right = '16px';
    el.style.zIndex = 9999;
    el.style.padding = '8px 12px';
    el.style.borderRadius = '6px';
    el.style.background = isError ? '#c62828' : '#2e7d32';
    el.style.color = '#fff';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
})();
