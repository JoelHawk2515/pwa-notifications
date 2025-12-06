const express = require('express');
const router = express.Router();
const { registerUser, loginUser, logoutUser } = require('../controllers/authController');
const { authLimiter } = require('../middleware/securityMiddleware');

// Root route - redirect to dashboard or login
router.get('/', (req, res) => {
    console.log('Root check session:', req.session);
    if (req.session && req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// Registration route
router.get('/signup', (req, res) => {
    const user = req.session?.user || null;
    res.render('signup', { user });
});
router.post('/signup', authLimiter, registerUser);

// Login route
router.get('/login', (req, res) => {
    const user = req.session?.user || null;
    res.render('login-new', { user });  // Render the modern login form
});

router.post('/login', authLimiter, loginUser);

// Logout route
router.post('/logout', logoutUser);

// Add GET route for logout link in sidebar
router.get('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.redirect('/dashboard');
            }
            res.redirect('/login');
        });
    } else {
        res.redirect('/login');
    }
});

module.exports = router;

/*
authRoutes.js:
Redundant router.get('/login') and router.post('/login') routes:
These routes are fine for rendering the login form and handling the login request. However, you should ensure that your controller methods (registerUser, loginUser, etc.) handle the logic appropriately.
*/