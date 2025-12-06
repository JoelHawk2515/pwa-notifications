# End-to-End Testing Guide

## Sprint 1: Test Send Button Validation

### Prerequisites
- Server running on `http://localhost:3005`
- Chrome or Edge browser (for best PWA support)
- Admin account: username `Joel Padgett`, password (as configured)

### Test Flow

#### 1. Server Health Check
```powershell
curl.exe http://localhost:3005/health
```
Expected: `{"status":"ok","time":"..."}`

#### 2. Login Flow
1. Navigate to `http://localhost:3005/login`
2. Enter admin credentials
3. Should redirect to `/dashboard`
4. Check browser console for session logging

#### 3. Service Worker Registration
**Automatic on dashboard load**
- Dashboard loads `register-push.js` automatically
- Browser should prompt for notification permission
- Click "Allow" when prompted
- Check console for: `Subscribed to push successfully`
- Green toast notification should appear bottom-right: "Subscribed to push successfully"

**Troubleshooting:**
- Open DevTools → Application → Service Workers
- Verify `/sw.js` is active
- Check Console for any registration errors
- Verify `window.PUBLIC_VAPID_KEY` is defined (check page source)

#### 4. Subscription Verification
**Server logs should show:**
```
Subscription saved: https://fcm.googleapis.com/fcm/send/...
```

**Database check (optional):**
```sql
SELECT endpoint, domain, site_identifier FROM subscribers ORDER BY id DESC LIMIT 1;
```

#### 5. Test Send Button
1. On dashboard, click **"Send Test Notification"** button
2. Status indicator shows: `Sending…`
3. Expected outcomes:

**Success:**
- Status shows: `Success (sent: 1)` (or number of subscribers)
- Browser notification appears with:
  - Title: "Test Notification"
  - Body: "This is a quick end-to-end test."
- Click notification → redirects to dashboard

**Failure - No subscribers:**
- Status shows: `Failed: No subscribers for this domain`
- **Fix:** Ensure step 3 (Service Worker Registration) completed successfully
- Check `site_identifier` is set: open `/debug-session` in new tab

**Failure - Site identifier missing:**
- Status shows: `Failed: siteIdentifier is required`
- **Fix:** Verify user has entry in `user_sites` table
- Server should auto-populate from `user_sites` on dashboard load

#### 6. Notification Analytics (Future)
After clicking notification:
- Service worker tracks click event
- Posted to `/track-push` endpoint
- Stored in `notification_analytics` table

### Expected Server Logs

```
Dashboard check session: Session { cookie: {...}, user: {...} }
Running query to get domain for siteIdentifier: <identifier>
Resolved targetDomain: <identifier>.solutiosoftware.com
Found subscribers: 1
Processing subscriber: <id>
Sending notification to endpoint: https://fcm.googleapis.com/...
Notification sent successfully to endpoint: ...
All notifications sent successfully
```

### Common Issues

**Issue:** "Push registration error: DOMException: Registration failed"
- **Cause:** Service worker registration failed
- **Fix:** Check for syntax errors in `/sw.js`; reload page

**Issue:** "Subscription failed: 400 Invalid subscription data"
- **Cause:** Missing required fields (endpoint, keys, domain, site_identifier)
- **Fix:** Check console for validation log showing which field is missing

**Issue:** "Failed: No subscribers for this domain"
- **Cause:** Subscription not stored or domain mismatch
- **Fix:** 
  - Verify `domain` field in subscribers table matches `location.hostname`
  - Check `site_identifier` is populated for user
  - Re-subscribe by refreshing dashboard

**Issue:** Notification permission already denied
- **Cause:** Previously denied permission
- **Fix:** 
  - Chrome: Click lock icon in address bar → Permissions → Reset
  - Edge: Similar permission reset in site settings

### Manual Database Setup (if needed)

If user doesn't have a `site_identifier`:

```sql
-- Check existing sites
SELECT * FROM sites;

-- Insert a test site (if needed)
INSERT INTO sites (siteCode, siteIdentifier, domain) 
VALUES ('TEST001', 'test-site', 'test-site.solutiosoftware.com');

-- Link user to site
INSERT INTO user_sites (user_id, site_identifier) 
VALUES (2, 'test-site');
```

### Success Criteria

✅ Service worker registered and active  
✅ Push subscription stored in database  
✅ Test send button triggers notification  
✅ Notification appears in OS notification center  
✅ Click redirects to dashboard  
✅ No console errors  

### Next Steps

After validating Sprint 1:
- Add notification scheduling UI
- Implement audience segmentation
- Build analytics dashboard
- Add CSRF protection
- Rate limiting for send endpoint
