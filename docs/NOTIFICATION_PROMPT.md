# Notification Permission Prompt System

## Overview

An automatic, user-friendly notification permission prompt system that intelligently asks users to enable push notifications without being intrusive.

## Features

✅ **Smart Timing** - Appears 3 seconds after page load  
✅ **Respects User Choice** - 7-day cooldown if dismissed  
✅ **Fully Responsive** - Beautiful on all screen sizes  
✅ **Smooth Animations** - Professional slide-in/out effects  
✅ **Success Feedback** - Clear messages for all states  
✅ **LocalStorage Persistence** - Remembers user preferences  
✅ **Zero Dependencies** - Pure vanilla JavaScript  
✅ **Event System** - Custom events for app integration  

## How It Works

1. **Page loads** → Script checks browser support and permission status
2. **3 seconds later** → If permission not granted/denied, show prompt
3. **User clicks "Enable"** → Browser permission dialog appears
4. **Permission granted** → Success message + custom event fired
5. **User clicks "Dismiss"** → Hide prompt, don't show again for 7 days

## Files Added

```
public/
  js/
    notification-prompt.js          # Main prompt script
  notification-prompt-demo.html      # Standalone demo page
views/
  notification-settings.ejs          # Admin settings page
routes/
  userRoutes.js                      # Added /notification-settings route
views/partials/
  _head.ejs                          # Added script include
docs/
  NOTIFICATION_PROMPT.md             # This documentation
```

## Usage

### Automatic (Default)

The prompt is already included in all pages via `_head.ejs` and will automatically show when appropriate:

```html
<!-- Already added to _head.ejs -->
<script src="/js/notification-prompt.js" defer></script>
```

### Manual Control

```javascript
// Show prompt manually
window.NotificationPrompt.show();

// Hide prompt
window.NotificationPrompt.hide();

// Check permission status
const status = window.NotificationPrompt.checkPermission();
// Returns: 'default', 'granted', 'denied', or 'unsupported'

// Check browser support
if (window.NotificationPrompt.isSupported()) {
  console.log('Notifications supported');
}

// Listen for permission granted
window.addEventListener('notificationPermissionGranted', (event) => {
  console.log('User granted permission!', event.detail);
  // Subscribe to push notifications here
});
```

## Configuration

Edit `/public/js/notification-prompt.js` to customize:

```javascript
const CONFIG = {
  // Delay before showing prompt (milliseconds)
  delayBeforePrompt: 3000, // 3 seconds
  
  // Days before showing again after dismissal
  promptCooldownDays: 7,
  
  // LocalStorage keys (customize if needed)
  storageKeys: {
    lastPrompted: 'notification_last_prompted',
    userDismissed: 'notification_user_dismissed',
    permissionGranted: 'notification_permission_granted'
  }
};
```

## Admin Settings Page

Access at: `/notification-settings` (requires login)

Features:
- View current permission status
- Preview the prompt
- Request permission manually
- Reset prompt state for testing
- Integration instructions
- JavaScript API documentation

## Demo Page

Access at: `/notification-prompt-demo.html`

A standalone demo page showing:
- Live permission status
- Interactive controls
- Feature overview
- Integration guide

## User Experience Flow

### First Visit
```
1. User lands on page
2. After 3 seconds → Prompt slides down from top
3. User sees: "Stay Updated! Enable notifications..."
4. Two options: "Enable Notifications" or "Maybe Later"
```

### User Clicks "Enable"
```
1. Browser permission dialog appears
2. If granted → Success message: "✅ Notifications Enabled!"
3. Custom event fired → App can subscribe user
4. Prompt hidden, won't show again
```

### User Clicks "Maybe Later"
```
1. Prompt slides up and disappears
2. Timestamp saved to localStorage
3. Won't show again for 7 days
4. User can still enable via browser settings
```

### User Clicks "X" (Close)
```
Same as "Maybe Later" - respects dismissal
```

## Permission States

| State | Description | Prompt Behavior |
|-------|-------------|-----------------|
| `default` | Not asked yet | ✅ Show prompt |
| `granted` | User allowed | ❌ Don't show |
| `denied` | User blocked | ❌ Don't show |
| `unsupported` | Browser doesn't support | ❌ Don't show |

## LocalStorage Keys

| Key | Purpose | Value |
|-----|---------|-------|
| `notification_last_prompted` | When prompt was last shown | Timestamp (number) |
| `notification_user_dismissed` | User clicked dismiss | `'true'` or absent |
| `notification_permission_granted` | Permission was granted | `'true'` or absent |

## Styling Customization

The prompt is styled with inline CSS for portability. To customize colors/design:

```javascript
// Edit in notification-prompt.js around line 150
const styles = document.createElement('style');
styles.textContent = `
  .notification-prompt-banner {
    background: white;           /* Change banner background */
    box-shadow: 0 4px 20px...;   /* Adjust shadow */
  }
  
  .notification-prompt-icon {
    background: linear-gradient(...); /* Change icon gradient */
  }
  
  .notification-prompt-btn-primary {
    background: linear-gradient(...); /* Change button color */
  }
`;
```

## Browser Support

- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Safari 13+
- ✅ Edge 79+
- ✅ Opera 37+
- ❌ Internet Explorer (not supported)

**Note:** Service Workers and Push Notifications require HTTPS (except localhost for development).

## Testing

### Test the Prompt
1. Visit `/notification-prompt-demo.html`
2. Wait 3 seconds or click "Show Prompt Now"
3. Interact with the prompt
4. Check status updates

### Reset for Testing
```javascript
// In browser console or via demo page
localStorage.removeItem('notification_last_prompted');
localStorage.removeItem('notification_user_dismissed');
localStorage.removeItem('notification_permission_granted');
location.reload(); // Reload to see prompt again
```

### Test Different States
```javascript
// Simulate granted permission
localStorage.setItem('notification_permission_granted', 'true');

// Simulate recent dismissal
localStorage.setItem('notification_last_prompted', Date.now().toString());
localStorage.setItem('notification_user_dismissed', 'true');
```

## Integration with Push Subscription

When user grants permission, automatically subscribe:

```javascript
window.addEventListener('notificationPermissionGranted', async (event) => {
  console.log('Permission granted!', event.detail);
  
  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
    });
    
    // Send subscription to your server
    await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        site_identifier: 'your-site-identifier'
      })
    });
    
    console.log('Subscribed to push notifications');
  } catch (error) {
    console.error('Failed to subscribe:', error);
  }
});
```

## Troubleshooting

### Prompt doesn't appear
- Check browser console for errors
- Verify script is loaded: `window.NotificationPrompt`
- Check permission status: Already granted/denied?
- Check localStorage: Recently dismissed?
- Ensure 3 seconds have passed since page load

### Permission dialog doesn't show
- Must be triggered by user interaction (click)
- Check if permission already denied
- Verify HTTPS (required for service workers)
- Try different browser

### Prompt appears every time
- Check localStorage persistence
- Verify localStorage is enabled
- Check for localStorage clearing on page load
- Browser in incognito mode clears storage

### Styling looks broken
- Check for CSS conflicts
- Verify styles are injected: Look for `#notification-prompt-styles` in head
- Check z-index conflicts (prompt uses 999999)

## Best Practices

✅ **Do:**
- Show after user has engaged with content (3+ seconds)
- Use clear, benefit-focused messaging
- Respect user dismissals with cooldown period
- Provide easy way to enable later
- Test on mobile devices

❌ **Don't:**
- Show immediately on page load
- Show repeatedly if user dismisses
- Use misleading or pushy language
- Block content behind notification permission
- Show if permission already denied

## Privacy Considerations

- Permission status is stored in localStorage (client-side only)
- No server-side tracking of prompt interactions
- User can clear localStorage anytime
- Respects browser's "Do Not Track" setting
- GDPR compliant (user choice, clear purpose)

## Future Enhancements

Potential improvements:
- [ ] Server-side configuration via admin panel
- [ ] A/B testing different prompt styles
- [ ] Custom messaging per site
- [ ] Analytics integration
- [ ] Multiple prompt styles (modal, slide-in, etc.)
- [ ] Scheduled prompts (show at specific times)
- [ ] User segmentation (show to specific user types)

## Support

For issues or questions:
1. Check this documentation
2. Visit `/notification-settings` for testing tools
3. Check browser console for errors
4. Test with `/notification-prompt-demo.html`

## License

Part of the PWA Notifications system.
