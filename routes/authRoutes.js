const express = require('express');
const router = express.Router();
const { registerUser, loginUser, logoutUser } = require('../controllers/authController');

// Registration route
router.get('/signup', (req, res) => {
    res.render('signup');
});
router.post('/signup', registerUser);

// Login route
router.get('/login', (req, res) => {
    res.render('login');  // Render the login form
});

router.post('/login', loginUser);

// Logout route
router.post('/logout', logoutUser);

module.exports = router;

/*
authRoutes.js:
Redundant router.get('/login') and router.post('/login') routes:
These routes are fine for rendering the login form and handling the login request. However, you should ensure that your controller methods (registerUser, loginUser, etc.) handle the logic appropriately.
*/