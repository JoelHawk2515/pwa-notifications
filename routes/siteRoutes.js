const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('../dbSetup');
const { trackClick, trackClickWithSiteCode } = require('../controllers/trackingController');
const { createPushForm, createPush } = require('../controllers/siteController');
const { checkUserRole } = require('../middleware/authMiddleware');

// Track clicks for all sites
router.get('/track-click', trackClick);

// Track clicks for a specific site code
router.get('/track-click/:siteCode', trackClickWithSiteCode);

// Route to display the create push form, restricted to admins
router.get('/create-push', checkUserRole, createPushForm);

// Route to handle the creation of push notifications
router.post('/create-push', checkUserRole, createPush);

// Route to display the 'sites' page
router.get('/all-sites', async (req, res) => {
    // Check if the user is logged in and has a valid session
    if (!req.session || !req.session.user) {
        return res.redirect('/login');  // Redirect to login if no session or user is found
    }

    const user = req.session.user;  // Get user from session
    const isAdmin = user.role === 'administrator';  // Check if the user has the 'administrator' role

    const breadcrumbs = [
        { name: 'Home', url: '/' },
        { name: 'Sites', url: '/all-sites' }
    ];

    try {
        // Fetch site data if needed
        let sites = [];
        if (isAdmin) {
            const connection = await connectToDatabase();
            const [results] = await connection.query('SELECT siteCode, siteIdentifier FROM sites');
            sites = results;  // Store the site data (siteCode and siteIdentifier)
        }

        // Pass the dynamic data to the template
        const data = {
            title: 'All Sites',
            message: 'Welcome to the sites page!',
            breadcrumbs: breadcrumbs,
            isAdmin: isAdmin,  // Pass the actual admin status based on session
            sites: sites
        };

        // Render 'sites.ejs' and pass the dynamic data
        res.render('sites', data);
    } catch (error) {
        console.error('Error fetching site data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/api/get-all-site-codes', async (req, res) => {
    // Check if the user is logged in and has the 'administrator' role
    if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
        return res.status(403).json({ error: 'Forbidden: You must be an administrator to access this endpoint.' });
    }
  
    try {
        const connection = await connectToDatabase();
        const [results] = await connection.query('SELECT siteCode FROM sites');
  
        // Send the site codes as a JSON response
        res.json(results);
    } catch (error) {
        console.error('Error fetching site codes:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to get analytics for a site, display it in analytics.ejs
router.get('/analytics', async (req, res) => {
    // Ensure user is logged in and has admin privileges
    if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
        return res.redirect('/login');  // Redirect to login if not an admin
    }

    const user = req.session.user;
    const isAdmin = user.role === 'administrator';

    const breadcrumbs = [
        { name: 'Home', url: '/' },
        { name: 'Analytics', url: '/analytics' }
    ];

    try {
        const connection = await connectToDatabase();
        
        // Fetch site analytics data including active subscribers count
        const [analyticsResults] = await connection.query(`
            SELECT 
                s.siteCode,
                COUNT(DISTINCT na.notification_id) AS interactions,
                SUM(CASE WHEN na.event_type = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN na.event_type = 'click' THEN 1 ELSE 0 END) AS click_count,
                SUM(CASE WHEN na.event_type = 'conversion' THEN 1 ELSE 0 END) AS conversion_count,
                COUNT(DISTINCT sub.endpoint) AS active_subscribers
            FROM notification_analytics na
            JOIN sites s ON na.site_identifier = s.siteIdentifier
            LEFT JOIN subscribers sub ON sub.site_identifier = s.siteIdentifier
            GROUP BY s.siteCode;
        `);

        // Log the results to check if the query returns data
        console.log('Analytics Data:', analyticsResults);

        // Pass the data to the view
        const data = {
            title: 'Push Notification Analytics',
            message: 'Overview of push notification analytics.',
            breadcrumbs: breadcrumbs,
            isAdmin: isAdmin,
            analyticsData: analyticsResults,
            user: user
        };

        // Render the 'analytics.ejs' page with the data
        res.render('analytics', data);
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/*app.get('/api/get-all-site-codes', (req, res) => {
    // Assuming 'sites' is the name of your table
    connection.query('SELECT siteCode, siteIdentifier FROM sites', (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Error querying the database');
        }

        // Send the results as a JSON response
        res.json(results);
    });
});*/

module.exports = router;

/*
siteRoutes.js:
Call to connectToDatabase for site data:

In the /all-sites route, you're making a database call inside a try-catch block. If your database connection fails or the query fails, make sure to handle that gracefully. You seem to be doing this well already.
Dynamic rendering of sites:

In the /all-sites route, sites are passed to the view, and the logic seems fine.
*/