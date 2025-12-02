const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('../dbSetup');
const { dynamicCors } = require('../middleware/corsMiddleware');
const { subscribe, sendNotification, trackPushEvent } = require('../controllers/notificationController');
const { createPushForm, createPush } = require('../controllers/notificationController'); // Import functions from the controller

// Route for subscribing to push notifications
router.post('/subscribe', dynamicCors, subscribe);

// Route for sending push notifications
router.post('/send-notification', sendNotification);

router.get('/send-notification/:siteCode', dynamicCors, async (req, res) => {
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
  
        const siteIdentifier = siteCode;
  
        // Get the errorMessage from query parameters if it exists
        const errorMessage = req.query.errorMessage || null;
  
        // Render the EJS template and pass siteCode, siteIdentifier, user, and errorMessage
        res.render('send-notification', { siteCode, siteIdentifier, user, errorMessage });
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Error querying the database');
    }
});

// Track push notification event
router.post('/track-event', async (req, res) => {
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

module.exports = router;