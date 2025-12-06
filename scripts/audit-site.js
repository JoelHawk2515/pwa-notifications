// Browser audit tool: visits pages, logs console errors, network failures, JS exceptions, a11y, timings, headers
// Requires: npm install --save-dev playwright axe-core

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const axeSource = require('axe-core').source;

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:3005';
const ADMIN_USER = process.env.AUDIT_USER || 'Joel Padgett';
const ADMIN_PASS = process.env.AUDIT_PASS || 'Computer4';

// Optional audit config support
let ROUTES = [
  '/',
  '/dashboard',
  '/all-sites',
  '/analytics',
  '/send-notification',
  '/profile',
  '/notification-settings',
  '/sites',
  '/login',
  '/signup',
];

try {
  const cfgPath = path.join(__dirname, '..', 'config', 'audit.config.json');
  if (fs.existsSync(cfgPath)) {
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const userCfg = JSON.parse(raw);
    if (Array.isArray(userCfg.routes)) ROUTES = userCfg.routes;
  }
} catch {}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function login(page) {
  // Navigate to login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  // Try modern form ids first, fallback to name attributes
  await page.fill('input[name="username"], #username', ADMIN_USER);
  await page.fill('input[name="password"], #password', ADMIN_PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"], button#loginBtn'),
  ]);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const outDir = path.join(__dirname, '..', 'audit');
  await ensureDir(outDir);
  const errorsLogPath = path.join(outDir, 'errors.json');
  const screenshotsDir = path.join(outDir, 'screens');
  await ensureDir(screenshotsDir);
  const harDir = path.join(outDir, 'traces');
  await ensureDir(harDir);
  const reportPath = path.join(outDir, 'report.html');

  const errors = [];

  // Capture console messages
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text(), location: msg.location() });
    }
  });

  // Capture page errors
  page.on('pageerror', (err) => {
    errors.push({ type: 'exception', text: err.message, stack: err.stack });
  });

  // Capture failed requests
  page.on('requestfailed', (req) => {
    errors.push({ type: 'network', url: req.url(), method: req.method(), failure: req.failure() });
  });

  // Capture response headers for main document and APIs
  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      const status = resp.status();
      const headers = resp.headers();
      if (url.startsWith(BASE_URL)) {
        errors.push({ type: 'headers', url, status, headers });
      }
    } catch {}
  });

  // Login (if protected pages)
  try {
    await login(page);
  } catch (e) {
    errors.push({ type: 'login', text: e.message });
  }

  // Simple schema registry
  const schemas = {
    subscribers: (body) => {
      return body && typeof body.success === 'boolean' && Array.isArray(body.subscribers);
    },
    realtime: (body) => {
      return body && body.data && typeof body.data.recent_sent !== 'undefined';
    }
  };

  // Visit each route
  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    try {
      // Start tracing for this route (Playwright trace as HAR-like artifact)
      await context.tracing.start({ screenshots: false, snapshots: true, sources: false });
      await page.goto(url, { waitUntil: 'networkidle' });

      // Performance timings
      const perfJson = await page.evaluate(() => JSON.stringify({
        nav: performance.getEntriesByType('navigation')[0] || null,
        resources: performance.getEntriesByType('resource').slice(0, 50)
      }));
      const timings = JSON.parse(perfJson);

      // A11y audit
      await page.addScriptTag({ content: axeSource });
      const axeResults = await page.evaluate(async () => {
        return await axe.run(document, { resultTypes: ['violations'] });
      });
      if (axeResults.violations && axeResults.violations.length) {
        errors.push({ type: 'a11y', url, violations: axeResults.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length })) });
      }

      // API schema checks based on route
      try {
        if (route.includes('subscribers')) {
          const apiUrl = `${BASE_URL}/api/subscribers?site_identifier=localhost`;
          const r = await page.request.get(apiUrl);
          const body = await r.json();
          if (!schemas.subscribers(body)) {
            errors.push({ type: 'schema', url: apiUrl, text: 'Invalid subscribers response shape' });
          }
        }
        if (route.includes('analytics')) {
          const apiUrl = `${BASE_URL}/api/analytics/realtime?site_identifier=localhost`;
          const r = await page.request.get(apiUrl);
          const body = await r.json();
          if (!schemas.realtime(body)) {
            errors.push({ type: 'schema', url: apiUrl, text: 'Invalid realtime analytics response shape' });
          }
        }
      } catch (e) {
        errors.push({ type: 'schema', url: url, text: e.message });
      }

      // Screenshot
      await page.waitForTimeout(500); // settle
      const shotName = `${route.replace(/[\/?&=]/g, '_')}.png`;
      await page.screenshot({ path: path.join(screenshotsDir, shotName), fullPage: true });

      // Stop tracing and save
      const traceName = `${route.replace(/[\/?&=]/g, '_')}.trace.zip`;
      await context.tracing.stop({ path: path.join(harDir, traceName) });

      // Store metrics summary
      errors.push({ type: 'metrics', url, timings });
    } catch (e) {
      errors.push({ type: 'navigation', url, text: e.message });
    }
  }

  // Save errors
  await fs.promises.writeFile(errorsLogPath, JSON.stringify({ baseUrl: BASE_URL, timestamp: new Date().toISOString(), errors }, null, 2));

  // Generate simple HTML report
  const byType = errors.reduce((acc, e) => { acc[e.type] = (acc[e.type]||0)+1; return acc; }, {});
  const rows = errors.map(e => `<tr><td>${e.type}</td><td>${e.url||''}</td><td>${(e.text||'').replace(/</g,'&lt;')}</td></tr>`).join('');
  const reportHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Audit Report</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;margin:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#f5f5f5;text-align:left} .summary{margin-bottom:16px}</style></head>
  <body><h1>Audit Report</h1>
  <div class="summary"><strong>Base:</strong> ${BASE_URL} &nbsp; <strong>Count:</strong> ${errors.length}</div>
  <div class="summary">${Object.entries(byType).map(([k,v])=>`${k}: ${v}`).join(' | ')}</div>
  <table><thead><tr><th>Type</th><th>URL</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
  await fs.promises.writeFile(reportPath, reportHtml, 'utf-8');

  console.log(`Audit complete. Errors: ${errors.length}`);
  console.log(`Screenshots: ${screenshotsDir}`);
  console.log(`Log: ${errorsLogPath}`);
  console.log(`Report: ${reportPath}`);

  await browser.close();
}

run().catch((e) => {
  console.error('Audit failed:', e);
  process.exit(1);
});
