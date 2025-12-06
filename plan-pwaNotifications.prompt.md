Plan: Feature Inventory + Suite Outline

A structured inventory of what’s implemented now, then a phased plan to evolve it into a comprehensive, multi-tenant push platform with strong analytics and tooling.

Steps
1. Inventory current features across auth, users, sites, notifications, analytics, middleware, DB, views, and config.
2. Identify gaps and inconsistencies (schema vs code, SW registration, targeting logic).
3. Propose full-suite capabilities and architecture: admin console, orchestration, segmentation, scheduling, experiments, analytics, consent, security, API, SDK.
4. Outline migration and implementation phases tied to your existing repo.

Further Considerations
1. Data model changes: add missing `first_name`, `last_name`, and `site_identifier` fields; unify domain resolution via `sites`.
2. Client integration: add service worker and registration scripts; align notification payloads with tracking.
3. Security baseline: session/cookie hardening, CSRF, validation, rate limiting.

Feature Inventory

- Auth
  - Login: `POST /login` via `authController` (SHA-256 password check; sets `req.session.user`).
  - Signup: `GET /signup`, `POST /signup` (SHA-256 hash; default role “site-access level”).
  - Logout: `POST /logout` (destroys session).
  - Root: `/` redirects to `/dashboard` if session, else `/login`.
  - Session: `express-session` with cookie `{ httpOnly, secure in prod, maxAge, sameSite: 'lax' }`.

- Users
  - Add user (admin): `POST /add-user` (optional site assignment via `user_sites`).
  - Register user: `POST /signup` (same as auth, modular).
  - Get profile: `GET /profile` guarded; renders `profile.ejs`.
  - Update user: `POST /update` (admin only); updates profile fields.

- Sites
  - Tracking routes: `GET /track-click` and `GET /track-click/:siteCode` via `trackingController`.
  - Create-push form and creation: `GET/POST /create-push` (admin) via `siteController`; inserts sites into DB with unique `siteIdentifier`.

- Notifications
  - Subscribe: `POST /subscribe` (requires `endpoint`, `keys`, `domain`, `site_identifier`; stores subscriber; uses dynamic CORS).
  - Send notification: `POST /send-notification` (admin) via `notificationController`; targets subscribers by `site_identifier`; payload includes targeting info.
  - Send notification page: `GET /send-notification/:siteCode` (admin) to render `send-notification.ejs`.
  - Event tracking: `POST /track-event` to `notification_analytics`.

- Analytics
  - Analytics dashboard: `GET /analytics` (admin) renders `analytics.ejs` with per-site metrics:
    - interactions, opens, clicks, conversions, active subscribers.
    - Based on `notification_analytics` joins.

- Admin UX
  - Side menus: `GET /side-menu-admin` (admin) and `GET /side-menu` (general) serve partials for navigation.

- Middleware
  - `authMiddleware.checkUserRole`: guards admin-only routes.
  - `corsMiddleware.dynamicCors`: looks up `domain` from `sites` using `site_identifier` → sets CORS headers dynamically; preflights.

- DB / Schema (created by `dbSetup.createDatabaseTables`)
  - `sites(id, siteCode, domain, siteIdentifier, idx_siteIdentifier)`
  - `subscribers(id, endpoint, subscriptionKeys, domain)`
  - `users(id, username, email, password, role DEFAULT 'site-access')`
  - `user_sites(id, user_id, site_identifier)`
  - `notifications(id, message, sent_at)`
  - `notification_analytics(id, notification_id, user_id, event_type, site_identifier, timestamp)`
  - Seeds admin user `jqel.padgett@gmail.com` (SHA-256 of “Computer4”).

- Views/EJS
  - `login.ejs`, `signup.ejs`, `dashboard.ejs`, `profile.ejs`, `sites.ejs`, `analytics.ejs`, `send-notification.ejs`, `side-menu*.ejs`, `index.ejs`.
  - `dashboard.ejs` checks admin role for menu; loads side menu via XHR.

- Static
  - `public/index.html`, `style.css`, `styles.css`, assets (favicon, logo, backgrounds).
  - No `service worker` file or client push registration present yet.

- Config
  - `config/config.js`: ENV-driven DB, SECRET_KEY, VAPID keys, URL-safe conversions; exports `ROUTE`, `urlSafePublicVapidKey`, `urlSafePrivateVapidKey`.
  - `notificationController` sets VAPID details; web-push dependency in `package.json`.

- Legacy vs Current
  - `server.js`: modularized routes/controllers; DB setup at start; static served after routes.
  - `server-old.js`: inline version of most functionality; kept for reference but not in use.

Suite Plan: Full Tools/Analytics/Notifications

- Admin Console
  - System dashboard: status, queue depth, failure rates, recent sends, per-site subscriber counts.
  - Tenant/site overview: filters by `siteIdentifier`, ownership, quotas, usage.
  - Role management: `administrator`, `site-manager`, `site-access`, `viewer` with route guards and UI gating.

- Site Management
  - CRUD with validation: `siteIdentifier`, `siteCode`, `domain(s)`, owner, status.
  - Domain binding: support custom origins; CORS allowlists; per-site VAPID keys (optional).
  - User-site mapping and invitations.

- Push Orchestration
  - Campaigns: define content, audience, schedule, recurrence; track lifecycle (draft, scheduled, sending, completed).
  - Templates: title/body/icon/image/actions; variables; localization; previews; versioning.
  - Delivery engine: batch sends with concurrency limits; retry on transient web-push errors; prune stale endpoints.
  - Staging: test sends to “internal subscribers” or specific segments before production.

- Targeting & Segmentation
  - Subscriber model: attributes (browser, lang, tz, lastActive, optIn, tags).
  - Segments: rule-based builders; saved segments; dynamic refreshes.
  - Exclusions: suppress certain tags or recent recipients; frequency capping.

- Scheduling
  - Immediate and scheduled sends; recurring campaigns (daily/weekly).
  - Timezone-aware scheduling; quiet hours.
  - Calendar UI and API.

- A/B/N Testing
  - Variant creation; sample allocation; auto-select winners by click/conversion.
  - Statistical tracking; experiment reports.

- Analytics
  - Delivery metrics: attempts, successes, failures; deduped per endpoint.
  - Engagement: opens, clicks, conversions; attribution windows.
  - Funnels and cohorts per campaign/site; export CSV; webhook streaming.
  - Live dashboards with real-time updates.

- Privacy & Consent
  - Consent tracking per subscriber; opt-in flows; DNT handling.
  - GDPR/CCPA tools (export/delete); retention policies.
  - Configurable privacy banners/links.

- Security
  - Session security: secure cookies in prod, CSRF on state-changing routes, input validation (schema-based), rate limits.
  - Key management: VAPID rotation, safe storage, audit logs.
  - Admin action audits.

- API
  - Auth endpoints; Sites CRUD; Subscribers CRUD; Campaigns CRUD; Notifications send/preview; Events track.
  - Webhooks: delivery/failure/engagement events to external systems.
  - API keys per tenant; quotas; rate limiting.

- SDK / Client Integration
  - Client JS: register service worker; request permission; subscribe via PushManager with public VAPID key; POST subscription (`endpoint`, `keys`, `site_identifier`).
  - Service worker: `push` to show notification; `notificationclick` to navigate; post engagement to `/track-event`.
  - Reference snippets per site; domain-aware; easy drop-in.

- Ops & Monitoring
  - Structured logs; correlation IDs; per-campaign logging.
  - Metrics: queue depth, error rates, latency; Prometheus endpoints.
  - Alerts on spike in failures or drop in deliveries.

- Billing (optional)
  - Meter sends and subscriber counts per tenant.
  - Plans and quotas; usage reports; invoicing hooks.

- Migration Path (from current repo)
  - Schema alignment:
    - Add `first_name`, `last_name` to `users`.
    - Ensure `subscribers` includes `site_identifier`; or always derive joins via `sites`.
  - Client SW:
    - Add `sw.js` and registration script; integrate into views; ensure `send-notification` payload fields align with SW expectations.
  - Notification IDs:
    - Insert into `notifications` before send; embed `notification_id` in payload; track using that ID.
  - Controller consistency:
    - Standardize domain/segment resolution; unify how `site_identifier` and `domain` drive queries.
  - Security enhancements:
    - CSRF tokens in forms; input validation middleware; rate limit `subscribe`/`send-notification`.
