const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');

// Registration logic
async function registerUser(req, res) {
    const { first_name, last_name, username, password, email } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check if the username or email already exists in the database
        const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
        const [existingUsers] = await connection.query(checkQuery, [username, email]);

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash the user's password using SHA-256
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // Insert the new user into the database with a default role ("site-access level")
        const insertQuery = 'INSERT INTO users (first_name, last_name, username, password, email, role) VALUES (?, ?, ?, ?, ?, ?)';
        await connection.query(insertQuery, [first_name, last_name, username, hashedPassword, email, 'site-access level']);

        return res.redirect('/login');
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Login logic
async function loginUser(req, res) {
    const { username, password } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [userResults] = await connection.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (userResults.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = userResults[0];
        const hashedInput = crypto.createHash('sha256').update(password).digest('hex');
        const isPasswordValid = hashedInput === user.password;

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Ensure session is persisted before redirecting
        req.session.regenerate((err) => {
            if (err) {
                console.error('Error regenerating session:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                first_name: user.first_name,
                last_name: user.last_name,
                profile_image: user.profile_image || null
            };

            console.log('User session after login:', req.session.user);

            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Error saving session:', saveErr);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }
                return res.redirect('/dashboard');
            });
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Logout logic
function logoutUser(req, res) {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        return res.status(200).json({ message: 'Logout successful' });
    });
}

// Export functions
module.exports = { registerUser, loginUser, logoutUser };