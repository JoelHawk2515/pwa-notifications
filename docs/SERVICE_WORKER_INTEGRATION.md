# Service Worker Integration Guide

## Issues Fixed in Your Service Worker

### ❌ **Critical Issues in Original Code:**

1. **Database code in service worker** (Lines 183-192)
   ```javascript
   // ❌ WRONG: Service workers run in browser, can't use mysql
   const connection = await mysql.createConnection(dbConfig);
   ```
   **Why it fails:** Service workers run in the browser. They can't access Node.js modules like `mysql` or server-side config.

2. **Invalid notification option** (Line 143)
   ```javascript
   const notificationOptions = {
     siteIdentifier: defaultNotificationData.siteIdentifier, // ❌ Not a valid property
   ```
   **Why it fails:** `siteIdentifier` is not a valid Notification API property. Must go in `data` object.

3. **Missing notificationId in data** (Lines 152-154)
   ```javascript
   data: {
     id: defaultNotificationData.id,           // ❌ Wrong property name
     notificationId: defaultNotificationData.notificationId, // Doesn't exist
   ```
   **Why it fails:** Your code uses `id` but doesn't copy it to `notificationId` in the data object.

4. **Hardcoded analytics URL**
   ```javascript
   const analyticsUrl = `https://app1.icecodelab.app/track-event`;
   ```
   **Issue:** Should be configurable per deployment.

---

## ✅ Corrected Service Worker

See `docs/service-worker-example.js` for the full corrected version.

### Key Changes:

1. **Removed database code** - All server-side operations happen via API calls
2. **Fixed notification options** - Only valid Notification API properties
3. **Proper data structure** - Custom data goes in `data` property
4. **Added API key authentication** - Required for `/track-event` endpoint
5. **Better error handling** - Catches and logs parsing errors
6. **Proper URL handling** - Focuses existing tabs or opens new ones

---

## How to Deploy Service Worker on Client Site

### Step 1: Configure Your Service Worker

Update these variables at the top of the service worker:

```javascript
const SITE_CODE = 'styles'; // Your site code from notification system
const SITE_IDENTIFIER = 'styles.solutiosoftware.com'; // Your domain
const NOTIFICATION_SERVER = 'https://app1.icecodelab.app'; // Your notification server
const API_KEY = 'your-api-key-here'; // Get from notification system admin
```

### Step 2: Register Service Worker on Your Site

Add this to your main HTML page or JavaScript entry point:

```javascript
// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
      
      // Request notification permission
      return Notification.requestPermission();
    })
    .then((permission) => {
      if (permission === 'granted') {
        console.log('Notification permission granted');
      }
    })
    .catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
}
```

### Step 3: Subscribe to Push Notifications

```javascript
async function subscribeToPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get or create subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Replace with your actual VAPID public key
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY';
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }
    
    // Send subscription to your notification server
    const response = await fetch('https://app1.icecodelab.app/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key'
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        site_identifier: 'styles.solutiosoftware.com',
        user_id: 'optional-user-id'
      })
    });
    
    if (response.ok) {
      console.log('Subscribed to push notifications');
    }
  } catch (err) {
    console.error('Failed to subscribe:', err);
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

---

## API Endpoints Reference

### 1. Subscribe to Notifications
**Endpoint:** `POST /subscribe`  
**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-api-key`

**Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "site_identifier": "styles.solutiosoftware.com",
  "user_id": "optional-user-123"
}
```

### 2. Track Notification Events
**Endpoint:** `POST /track-event`  
**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-api-key`

**Body:**
```json
{
  "notificationId": "notification-uuid",
  "siteIdentifier": "styles.solutiosoftware.com",
  "userId": "user-123",
  "eventType": "open" // or "click", "close"
}
```

---

## Data Flow

### Sending Notifications (Server → Client)

1. **Admin sends notification** via notification system UI
2. **Server pushes to browser** using Web Push Protocol
3. **Service worker receives** `push` event
4. **Browser shows notification** via `showNotification()`
5. **Service worker tracks 'open' event** via `/track-event` API

### User Clicks Notification (Client → Server → Client)

1. **User clicks notification** in browser
2. **Service worker receives** `notificationclick` event
3. **Service worker tracks 'click' event** via `/track-event` API
4. **Service worker opens URL** in browser tab
5. **Server logs analytics** in database

---

## Testing Your Integration

### 1. Test Service Worker Registration
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg);
  console.log('Active:', reg?.active?.state);
});
```

### 2. Test Notification Permission
```javascript
console.log('Notification permission:', Notification.permission);
```

### 3. Test Push Subscription
```javascript
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Subscription:', sub);
  });
});
```

### 4. Send Test Notification (from admin panel)
- Log into notification system
- Select your site
- Compose test notification
- Check browser DevTools Console for service worker logs

---

## Common Issues & Solutions

### Issue: "Service worker not found"
**Solution:** Ensure service worker file is at root of your domain or properly scoped.

### Issue: "Notification permission denied"
**Solution:** User must click allow. Can't be triggered programmatically without user interaction.

### Issue: "Push subscription failed"
**Solution:** Check that VAPID keys are correct and site is served over HTTPS.

### Issue: "Analytics not tracking"
**Solution:** Verify API key is correct and `/track-event` endpoint is accessible from browser.

### Issue: "Can't connect to database"
**Solution:** Remove all database code from service worker. Use API endpoints instead.

---

## Security Considerations

1. **API Keys:** Store API keys securely, rotate regularly
2. **HTTPS Required:** Service workers only work on HTTPS (except localhost)
3. **CORS:** Ensure notification server allows requests from your domain
4. **VAPID Keys:** Keep private VAPID key secret on server only
5. **User IDs:** Don't expose sensitive user data in push payloads

---

## Auto-Generated Service Workers

The notification system automatically generates a basic service worker when you create a site via:
- **Endpoint:** `POST /api/sites`
- **URL:** `/service-workers/{siteCode}/service-worker.js`

This generated service worker:
- ✅ Handles push events correctly
- ✅ Shows notifications with proper data structure
- ✅ Opens URLs on click
- ✅ Uses correct site code and identifier
- ❌ Does NOT include analytics tracking (add manually if needed)
- ❌ Does NOT include API key authentication (add if using analytics)

To add analytics tracking to auto-generated service workers, copy the `sendAnalyticsEvent()` function and event tracking calls from `docs/service-worker-example.js`.

---

## Next Steps

1. ✅ Update your service worker with corrected code
2. ✅ Configure SITE_CODE, SITE_IDENTIFIER, and API_KEY
3. ✅ Deploy service worker to your domain
4. ✅ Register service worker on page load
5. ✅ Test notification subscription
6. ✅ Send test notification from admin panel
7. ✅ Verify analytics tracking in database

---

## Support

For issues or questions:
- Check browser DevTools Console for service worker logs
- Verify CORS settings allow your domain
- Test with auto-generated service worker first
- Review network tab for failed API requests
