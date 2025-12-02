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
        res.render('profile', { user, isAdmin, sites });
    } catch (error) {
        console.error('Error fetching site data:', error);
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
router.get('/dashboard', (req, res) => {
    if (req.session && req.session.user) {
        // Get the message from the query parameters, if available
        const message = req.query.message || null;
  
        // Clear the session message after displaying it
        delete req.session.message;
  
        // Render the dashboard template and pass the user and message (if any)
        res.render('dashboard', { user: req.session.user, message });
    } else {
        res.redirect('/login');
    }
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
    res.render('side-menu');  // Render 'side-menu.ejs'
});

module.exports = router;