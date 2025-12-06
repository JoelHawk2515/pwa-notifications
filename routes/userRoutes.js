const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('../dbSetup');
const { registerUser, getUserProfile, updateUser, addUser } = require('../controllers/userController');
const { checkUserRole } = require('../middleware/authMiddleware');

// Route to add a new user (admin only)
router.post('/add-user', addUser);

// Route to handle user registration
router.post('/signup', registerUser);

// Protected route - example
router.get('/profile', async (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.user) {
        return res.redirect('/login');  // Redirect to login if no session or user is found
    }
  
    const user = req.session.user;  // Get user from session
  
    // Determine if the user is an admin
    const isAdmin = user.role === 'administrator';  // Check if the user has the 'administrator' role
  
    try {
        // If the user is an administrator, fetch the list of site codes
        let sites = [];
        if (isAdmin) {
            const connection = await connectToDatabase();
            const [results] = await connection.query('SELECT siteCode, siteIdentifier FROM sites');
            sites = results;  // Store the site data (siteCode and siteIdentifier)
        }
  
        // Pass the user, isAdmin, and sites data to the template
        res.render('profile-new', { user, isAdmin, sites });
    } catch (error) {
        console.error('Error fetching site data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// A/B Testing page route
router.get('/ab-testing', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }

    try {
        const user = req.session.user;
        const connection = await connectToDatabase();
        
        let site_identifier = 'localhost';
        if (user.role !== 'administrator') {
            const [userSites] = await connection.query(
                'SELECT site_identifier FROM user_sites WHERE user_id = ? LIMIT 1',
                [user.id]
            );
            if (userSites.length > 0) {
                site_identifier = userSites[0].site_identifier;
            }
        }

        res.render('ab-testing-new', { user, site_identifier });
    } catch (error) {
        console.error('Error loading A/B testing page:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Analytics dashboard route
router.get('/analytics-dashboard', async (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }

    try {
        const user = req.session.user;
        const connection = await connectToDatabase();
        
        // Get user's site identifier
        let site_identifier = 'localhost'; // Default
        if (user.role !== 'administrator') {
            const [userSites] = await connection.query(
                'SELECT site_identifier FROM user_sites WHERE user_id = ? LIMIT 1',
                [user.id]
            );
            if (userSites.length > 0) {
                site_identifier = userSites[0].site_identifier;
            }
        }

        res.render('analytics-dashboard-new', { user, site_identifier });
    } catch (error) {
        console.error('Error loading analytics dashboard:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Subscriber management route
router.get('/subscribers-dashboard', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    try {
        const user = req.session.user;
        const connection = await connectToDatabase();
        let site_identifier = 'localhost';
        if (user.role !== 'administrator') {
            const [userSites] = await connection.query(
                'SELECT site_identifier FROM user_sites WHERE user_id = ? LIMIT 1',
                [user.id]
            );
            if (userSites.length > 0) {
                site_identifier = userSites[0].site_identifier;
            }
        }
        res.render('subscriber-management-new', { user, site_identifier });
    } catch (err) {
        console.error('Error loading subscribers dashboard:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Define the route to get the user's profile
router.get('/api/user-profile', (req, res) => {
    // Check if the user is logged in
    if (!req.session.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
  
    // If authenticated, return the user's profile data (you can customize this)
    const user = req.session.user;
    res.json({
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_image: user.profile_image || null // Handle case where profile image is not available
    });
});

// Route to update the user profile
router.post('/update', checkUserRole, updateUser);

// Dashboard route
router.get('/dashboard', async (req, res) => {
    console.log('Dashboard check session:', req.session);
    if (req.session && req.session.user) {
        // Get the message from the query parameters, if available
        const message = req.query.message || null;
  
        // Clear the session message after displaying it
        delete req.session.message;
  
        // Ensure a site_identifier is available on the session user
        try {
            if (!req.session.user.site_identifier) {
                const connection = await connectToDatabase();
                const [rows] = await connection.query('SELECT site_identifier FROM user_sites WHERE user_id = ? LIMIT 1', [req.session.user.id]);
                if (rows && rows.length > 0) {
                    req.session.user.site_identifier = rows[0].site_identifier;
                }
            }
        } catch (err) {
            console.warn('Could not resolve site_identifier for user:', err.message);
        }

        // Render the dashboard template and pass the user, message, and VAPID key (if any)
        const { urlSafePublicVapidKey } = require('../config/config');
        res.render('dashboard-new', { user: req.session.user, message, urlSafePublicVapidKey });
    } else {
        res.redirect('/login');
    }
});

// Debug: inspect current session
router.get('/debug-session', (req, res) => {
    res.json({ hasSession: !!req.session, user: req.session?.user || null, cookie: req.headers.cookie || null });
});

// Route to display the admin side menu, restricted to administrators
router.get('/side-menu-admin', checkUserRole, (req, res) => {
    // Check if the user is logged in and has a valid session
    if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
        return res.redirect('/login');  // Redirect to login if not an admin or not logged in
    }

    // Get the user from the session
    const user = req.session.user;

    // Pass the user and any other dynamic data to the EJS template
    const dynamicData = {
        someKey: 'someValue',  // Example dynamic data
        user: user  // Pass the logged-in user object from session
    };

    res.render('side-menu-admin', dynamicData);  // Render 'side-menu-admin.ejs' and pass dynamic data
});

// Route to display the general side menu
router.get('/side-menu', (req, res) => {
    const user = req.session?.user || null;
    res.render('side-menu', { user });  // Render 'side-menu.ejs' with user
});

// Route to display notification settings page
router.get('/notification-settings', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const user = req.session.user;
    res.render('notification-settings', { user });
});

module.exports = router;