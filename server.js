const greenlock = require('greenlock-express');
const express = require('express');
const session = require('express-session');
const webPush = require('web-push');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { dynamicCors } = require('./middleware/corsMiddleware');
const { sanitizeBody, apiLimiter } = require('./middleware/securityMiddleware');
const dbSetup = require('./dbSetup');
const scheduler = require('./scheduler');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const siteRoutes = require('./routes/siteRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const templateRoutes = require('./routes/templateRoutes');
const abTestRoutes = require('./routes/abTestRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const { checkUserRole } = require('./middleware/authMiddleware');
const { dbConfig, secretKey, urlSafePublicVapidKey, urlSafePrivateVapidKey, ROUTE } = require('./config/config');

dbSetup.createDatabaseTables();

const app = express();

// Simple Prometheus-style metrics (in-memory counters)
const metrics = { sends: 0, failures: 0, opens: 0, clicks: 0, scheduler_runs: 0 };

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            // Allow Quill CSS from CDN
            styleSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.quilljs.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.quilljs.com", "https://unpkg.com"],
            // Lucide icons from unpkg.com; TinyMCE from jsDelivr if needed
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "http://localhost:3005", "ws:", "wss:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
}));

// Middleware for session management
app.use(
  session({
      secret: secretKey,
      resave: false,
      saveUninitialized: true,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: 'lax'
        }
  })
);

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply global CORS middleware for all routes
app.use(cors({
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
}));

// Use body-parser for handling JSON payloads
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Correlation ID middleware
app.use((req, res, next) => {
  const id = req.headers['x-request-id'] || Math.random().toString(36).slice(2);
  req.correlationId = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(
    `beacon_sends ${metrics.sends}\n` +
    `beacon_failures ${metrics.failures}\n` +
    `beacon_opens ${metrics.opens}\n` +
    `beacon_clicks ${metrics.clicks}\n` +
    `beacon_scheduler_runs ${metrics.scheduler_runs}\n`
  );
});

// Sanitize inputs to prevent XSS
app.use(sanitizeBody);

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);
app.use('/send-notification', apiLimiter);
app.use('/subscribe', apiLimiter);

// Apply dynamic CORS only on routes that need it (handled within route files)

// Use routes BEFORE static files
app.use('/', authRoutes);
app.use('/', notificationRoutes);
app.use('/', siteRoutes);
app.use('/', userRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', abTestRoutes);
app.use('/api', subscriberRoutes);
app.use('/api', uploadRoutes);
app.use('/api', webhookRoutes);
app.use('/', templateRoutes);

// Serve static files from the 'public' directory (after routes)
app.use(express.static(path.join(__dirname, 'public')));
// Explicitly expose generated service workers under /service-workers
app.use('/service-workers', express.static(path.join(__dirname, 'public', 'service-workers')));

// Simple health route for uptime checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = 3005;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start the notification scheduler
    scheduler.start();
    console.log('📅 Notification scheduler initialized');
});

module.exports = app;
module.exports.metrics = metrics;
