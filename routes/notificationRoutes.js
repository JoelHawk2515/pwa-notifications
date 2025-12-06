const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('../dbSetup');
const { dynamicCors } = require('../middleware/corsMiddleware');
const { validateNotificationPayload, requireAdmin, requireAuth, sendLimiter } = require('../middleware/securityMiddleware');
const { subscribe, sendNotification, trackPushEvent, sendTestNotification, batchUpdateNotifications } = require('../controllers/notificationController');
const { requireApiKey } = require('../middleware/apiKeyMiddleware');
const { createPushForm, createPush } = require('../controllers/notificationController'); // Import functions from the controller

// Route for subscribing to push notifications
router.post('/subscribe', requireApiKey, dynamicCors, subscribe);

// Route for sending push notifications (with validation and rate limiting)
router.post('/send-notification', requireAdmin, sendLimiter, validateNotificationPayload, sendNotification);

// Batch operations on notifications
router.post('/notifications/batch', requireAdmin, async (req, res) => {
    return batchUpdateNotifications(req, res);
});

// Quick test send endpoint
router.post('/notifications/test', requireAdmin, sendLimiter, async (req, res) => {
    try {
        const siteIdentifier = req.body.siteIdentifier || req.query.siteIdentifier;
        if (!siteIdentifier) {
            return res.status(400).json({ success: false, message: 'siteIdentifier is required' });
        }
        const result = await sendTestNotification(siteIdentifier);
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Compose page without site param: render with site selector
router.get('/send-notification', requireAdmin, async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
        return res.redirect('/login');
    }
    const user = req.session.user;
    try {
        const connection = await connectToDatabase();
        const [sites] = await connection.query('SELECT siteCode, siteIdentifier FROM sites ORDER BY siteCode ASC');
        // Render compose view without selected site; provide sites for selection
        res.render('send-notification-new', { siteCode: null, siteIdentifier: null, sites, user, errorMessage: null });
    } catch (err) {
        console.error('Error loading sites for compose:', err);
        res.status(500).send('Error loading sites');
    }
});

router.get('/send-notification/:siteCode', requireAdmin, dynamicCors, async (req, res) => {
    const siteCode = req.params.siteCode;
  
    // Check if the user is logged in and has the 'administrator' role
    if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
        // Redirect to the dashboard with an error message if not an administrator
        return res.redirect('/dashboard?errorMessage=You%20must%20be%20an%20administrator%20to%20send%20notifications.');
    }
  
    // Fetch the user from the session if they are logged in and an admin
    const user = req.session.user;
  
    try {
        const connection = await connectToDatabase();
        const [results] = await connection.query('SELECT siteIdentifier FROM sites WHERE siteCode = ?', [siteCode]);
  
        if (results.length === 0) {
            return res.status(404).send('Site code not found');
        }
  
        const siteIdentifier = results[0].siteIdentifier;
  
        // Get the errorMessage from query parameters if it exists
        const errorMessage = req.query.errorMessage || null;
  
        // Render the EJS template and pass siteCode, siteIdentifier, user, and errorMessage
        // Also pass full list of sites for quick switch
        const [sites] = await connection.query('SELECT siteCode, siteIdentifier FROM sites ORDER BY siteCode ASC');
        res.render('send-notification-new', { siteCode, siteIdentifier, sites, user, errorMessage });
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Error querying the database');
    }
});

// Notification Center view
router.get('/notification-center', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const user = req.session.user;
    res.render('notification-center-new', { user });
});

// Track push notification event
router.post('/track-event', requireApiKey, async (req, res) => {
    const { notificationId, siteIdentifier, eventType, userId } = req.body; // Added userId

    try {
        if (!notificationId || !userId) {
            return res.status(400).json({ message: 'Notification ID and User ID are required' });
        }

        // Track the event
        await trackPushEvent(notificationId, eventType, siteIdentifier, userId);

        res.status(200).json({ message: 'Event tracked successfully' });
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ message: 'Error tracking event' });
    }
});

// Templates (stub): return empty list to avoid 404s in UI until implemented
router.get('/api/templates', async (req, res) => {
    try {
        res.json({ success: true, templates: [] });
    } catch (err) {
        console.error('Error fetching templates:', err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Get scheduled notifications
router.get('/notifications/scheduled', requireAuth, async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    try {
        const connection = await connectToDatabase();
        const [scheduled] = await connection.query(
            `SELECT notification_id, site_identifier, title, body, scheduled_time, status 
             FROM notifications 
             WHERE status = 'scheduled' AND scheduled_time > NOW() 
             ORDER BY scheduled_time ASC`
        );
        res.json({ success: true, scheduled });
    } catch (err) {
        console.error('Error fetching scheduled notifications:', err);
        res.status(500).json({ success: false, message: 'Error fetching scheduled notifications' });
    }
});

// Get notification history with analytics
router.get('/notifications/history', requireAuth, async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    try {
        const connection = await connectToDatabase();
        const [history] = await connection.query(
            `SELECT n.notification_id, n.site_identifier, n.title, n.body, n.status, n.sent_at,
                    COUNT(DISTINCT na.id) as total_interactions,
                    COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.id END) as clicks
             FROM notifications n
             LEFT JOIN notification_analytics na ON n.notification_id = na.notification_id
             WHERE n.status = 'sent'
             GROUP BY n.id
             ORDER BY n.sent_at DESC
             LIMIT 50`
        );
        res.json({ success: true, history });
    } catch (err) {
        console.error('Error fetching notification history:', err);
        res.status(500).json({ success: false, message: 'Error fetching history' });
    }
});

module.exports = router;