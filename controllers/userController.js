const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');

// Function to connect to the database
async function connectToDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  return connection;
}

// Register a new user
async function registerUser(req, res) {
  const { first_name, last_name, username, password, email } = req.body;

  try {
    const connection = await connectToDatabase();
    
    // Check if the username or email already exists in the database
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    const [existingUsers] = await connection.query(checkQuery, [username, email]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash the user's password securely
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the new user into the database with a default role ("site-access level")
    const insertQuery = 'INSERT INTO users (first_name, last_name, username, password, email, role) VALUES (?, ?, ?, ?, ?, ?)';
    await connection.query(insertQuery, [first_name, last_name, username, hashedPassword, email, 'site-access level']);
    return res.redirect('/login');
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Add a new user by an administrator
async function addUser(req, res) {
    const { username, email, role, sites } = req.body;
  
    // Check if the user is logged in and is an administrator
    if (!req.session.user || req.session.user.role !== 'administrator') {
      return res.status(403).json({ error: 'You must be an administrator to perform this action.' });
    }
  
    // Hash the user's password securely
    const password = 'defaultpassword'; // Or allow for custom password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
  
    try {
      const connection = await connectToDatabase();
  
      // Insert the new user into the database
      const insertQuery = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
      await connection.query(insertQuery, [username, email, hashedPassword, role]);
  
      // Get the last inserted user ID
      const [newUserResults] = await connection.query('SELECT LAST_INSERT_ID() as id');
      const newUserId = newUserResults[0].id;
  
      // If role is 'site-access level', assign the user to specific sites
      if (role === 'site-access level' && sites) {
        const assignSitesQuery = 'INSERT INTO user_sites (user_id, site_identifier) VALUES ?';
        const siteValues = sites.map(siteIdentifier => [newUserId, siteIdentifier]);
        await connection.query(assignSitesQuery, [siteValues]);
      }
  
      return res.status(200).json({ message: 'User created successfully' });
    } catch (err) {
      console.error('Error adding new user:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Get the current user's profile
async function getUserProfile(req, res) {
  const userId = req.session.user.id;

  try {
    const connection = await connectToDatabase();
    const [userResults] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResults[0];
    res.json({
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Update user details
async function updateUser(req, res) {
  const { first_name, last_name, username, email } = req.body;
  const userId = req.session.user.id;

  try {
    const connection = await connectToDatabase();

    // Update the user's information
    const updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, username = ?, email = ? WHERE id = ?';
    await connection.query(updateQuery, [first_name, last_name, username, email, userId]);

    return res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
    registerUser,
    getUserProfile,
    updateUser,
    addUser,
};