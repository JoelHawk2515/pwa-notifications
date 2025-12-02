const greenlock = require('greenlock-express');
const express = require('express');
const session = require('express-session');
const webPush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const ROUTE = '/app1';
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const siteRoutes = require('./routes/siteRoutes');
const userRoutes = require('./routes/userRoutes');
const { checkUserRole } = require('./middleware/authMiddleware');
const { dynamicCors } = require('./middleware/corsMiddleware');
const { dbConfig, secretKey, urlSafePublicVapidKey, urlSafePrivateVapidKey, ROUTE } = require('./config');

// Set VAPID details for web-push
webPush.setVapidDetails(
  'mailto:jqel.padgett@gmail.com', 
  urlSafePublicVapidKey,
  urlSafePrivateVapidKey
);

// Function to connect to the database
async function connectToDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  return connection;
}

const app = express();

// Middleware for session management
app.use(
  session({
      secret: secretKey, // Replace with a strong secret key
      resave: false,
      saveUninitialized: true,
      cookie: {
          httpOnly: true, // Prevent client-side access to cookie
          secure: process.env.NODE_ENV === 'production', // Only send cookie over HTTPS in production
          maxAge: 24 * 60 * 60 * 1000, // 1 day expiry
          sameSite: 'strict' // Ensure the cookie is sent only to the same domain
      }
  })
);

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set views folder

// Generate a random secret key
const secretKey = crypto.randomBytes(32).toString('hex');
//console.log('Generated Secret Key:', secretKey);

app.options('*', cors()); // include before other routes

// Use body-parser for handling JSON payloads
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Registration route
app.post('/signup', async (req, res) => {
  const { first_name, last_name, username, password, email } = req.body; // Include first_name and last_name

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

      return res.redirect('/login'); // Redirect the user to the login page after successful registration
  } catch (error) {
      console.error('Error during registration:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      const connection = await connectToDatabase();
      const [userResults] = await connection.query(
          'SELECT * FROM users WHERE username = ?',
          [username]
      );

      if (userResults.length === 0) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      const user = userResults[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Store user profile in session with session cookie settings
      req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_image: user.profile_image || null  // Optional, handle missing profile image
      };

      // Set a custom message in the session to pass to the dashboard
      req.session.message = 'Successfully logged in!';

      // Redirect user to the dashboard
      return res.redirect('/dashboard');
  } catch (error) {
      console.error('Error during login:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/login', (req, res) => {
  res.render('login'); // Renders the login.ejs page
});

app.get('/signup', (req, res) => {
  res.render('signup'); // Renders the login.ejs page
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        return res.status(200).json({ message: 'Logout successful' });
    });
});

app.get('/side-menu-admin', (req, res) => {
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

    res.render('side-menu-admin', dynamicData); // Render 'side-menu-admin.ejs' and pass dynamic data
});

// Protected route - example
app.get('/profile', async (req, res) => {
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

app.post('/add-user', async (req, res) => {
  // Check if the user is logged in and an admin
  if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
      return res.status(403).json({ error: 'You must be an administrator to perform this action.' });
  }

  const { username, email, role, sites } = req.body;  // Get form data

  // Hash the user's password securely
  const password = 'defaultpassword'; // You can set a default password or prompt for one
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  try {
      const connection = await connectToDatabase();

      // Insert the new user into the database
      const insertQuery = `
          INSERT INTO users (username, email, password, role) 
          VALUES (?, ?, ?, ?)`;

      await connection.query(insertQuery, [username, email, hashedPassword, role]);

      // Get the last inserted user ID
      const [newUserResults] = await connection.query('SELECT LAST_INSERT_ID() as id');
      const newUserId = newUserResults[0].id;

      if (role === 'site-access level') {
          // Assign sites to the site-access level user
          const assignSitesQuery = `
              INSERT INTO user_sites (user_id, site_identifier)
              VALUES ?`;

          const siteValues = sites.map(siteIdentifier => [newUserId, siteIdentifier]);

          await connection.query(assignSitesQuery, [siteValues]);
      }

      res.redirect('/profile');  // Redirect to profile page after creating the user
  } catch (err) {
      console.error('Error adding new user:', err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
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

// Route to display the 'sites' page
app.get('/all-sites', (req, res) => {
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

  // You can pass dynamic data like a list of site codes if needed
  const data = {
      title: 'All Sites',
      message: 'Welcome to the sites page!',
      breadcrumbs: breadcrumbs,
      isAdmin: isAdmin  // Pass the actual admin status based on session
  };

  // Render 'sites.ejs' and pass the dynamic data
  res.render('sites', data);
});

app.get('/api/get-all-site-codes', async (req, res) => {
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

// Route to display the 'side-menu' page
app.get('/side-menu', (req, res) => {
  res.render('side-menu');  // Render 'side-menu.ejs'
});

// Route to display the 'profile' page
/*app.get('/profile', (req, res) => {
  if (!req.session.user) {
      return res.redirect('/login');  // Redirect to login if no user session
  }

  const userData = req.session.user;  // Pass user data from the session
  res.render('profile', { user: userData });  // Render 'profile.ejs' and pass the user data
});*/

// Define the route to get the user's profile
app.get('/api/user-profile', (req, res) => {
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

// Subscription route
app.post('/subscribe', async (req, res) => {
  const newSubscription = req.body;

  // Check for valid subscription object
  if (!newSubscription || !newSubscription.endpoint || !newSubscription.keys || !newSubscription.domain) {
      console.error('Invalid subscription object:', newSubscription);
      return res.status(400).send('Invalid subscription data');
  }

  const { endpoint, keys, domain } = newSubscription;
  const subscriptionKeys = JSON.stringify(keys); // Store the subscription keys as a string

  try {
      const connection = await connectToDatabase();
      
      // Check if the subscription already exists for the given endpoint
      const [results] = await connection.query('SELECT * FROM subscribers WHERE endpoint = ?', [endpoint]);

      if (results.length > 0) {
          console.log('Subscription already exists:', newSubscription);
          return res.status(409).send('Subscription already exists');
      }

      // Insert the subscription into the database
      const insertQuery = 'INSERT INTO subscribers (endpoint, subscriptionKeys, domain) VALUES (?, ?, ?)';
      await connection.query(insertQuery, [endpoint, subscriptionKeys, domain]);

      console.log('Subscription saved:', newSubscription);
      return res.status(201).send('Subscription saved');
  } catch (err) {
      console.error('Error saving subscription:', err);
      return res.status(500).send('Failed to save subscription');
  }
});

// Function to generate a random notificationId
function generateRandomNotificationId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let notificationId = '';
    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        notificationId += characters.charAt(randomIndex);
    }
    return notificationId;
}

// Route to handle sending notifications
app.post('/send-notification', checkUserRole, async (req, res) => {
  const { siteIdentifier, title, body, icon, badge, image, tag, silent, url } = req.body; // Accept `url` in the request body

  try {
      const connection = await connectToDatabase();

      // Check if the site identifier exists
      const [siteResults] = await connection.query('SELECT domain FROM sites WHERE siteIdentifier = ?', [siteIdentifier]);
      if (siteResults.length === 0) {
          await connection.end();
          console.error('Site identifier not found:', siteIdentifier);
          return res.status(404).send('Site identifier not found');
      }

      const targetDomain = siteResults[0].domain.replace(/^https?:\/\//, '');
      const [subscribers] = await connection.query('SELECT endpoint, subscriptionKeys FROM subscribers WHERE domain = ?', [targetDomain]);

      if (subscribers.length === 0) {
          await connection.end();
          console.error('No subscribers found for domain:', targetDomain);
          return res.status(404).send('No subscribers found for this domain');
      }

      let failedNotifications = [];
      for (const subscriber of subscribers) {
          try {
              const keys = JSON.parse(subscriber.subscriptionKeys); // Parse subscription keys from the database
              if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
                  throw new Error('Invalid subscription keys format');
              }

              const subscription = {
                  endpoint: subscriber.endpoint,
                  keys: keys
              };

              // Generate a random notificationId
              const notificationId = generateRandomNotificationId();

              const notificationPayload = JSON.stringify({
                  siteIdentifier: siteIdentifier,
                  title: title || 'New Notification',
                  body: body || '',
                  icon: icon || '',
                  badge: badge || '',
                  image: image || '',
                  tag: tag || '',
                  silent: silent || false,
                  data: {
                      id: notificationId,
                      url: url || '/' // Use the URL provided in the request body, or default to '/'
                  }
              });

              await webPush.sendNotification(subscription, notificationPayload);
              console.log('Notification sent to:', subscriber.endpoint);
          } catch (err) {
              console.error('Error sending notification to:', subscriber.endpoint, 'Error:', err);
              failedNotifications.push({ endpoint: subscriber.endpoint, error: err.message });
          }
      }

      if (failedNotifications.length > 0) {
          console.error('Failed notifications:', failedNotifications);
          return res.status(500).json({ success: false, message: 'Some notifications failed', failedNotifications });
      }

      res.status(200).json({ success: true, message: 'All notifications sent successfully' });
      await connection.end(); // Close the connection after all queries are done
  } catch (err) {
      console.error('Error during the overall notification sending process:', err);
      res.status(500).send('Failed to send notifications due to server error');
  }
});

app.get('/send-notification/:siteCode', dynamicCors, async (req, res) => {
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
      res.render('send-notification', { siteCode, siteIdentifier, user, errorMessage });
  } catch (err) {
      console.error('Error querying the database:', err);
      res.status(500).send('Error querying the database');
  }
});

app.get('/track-click', (req, res) => {
    var notificationId = req.query.notificationId;
    var siteIdentifier = req.query.siteIdentifier;

    // Append click information to a file
    const logEntry = `NotificationId: ${notificationId}, SiteIdentifier: ${siteIdentifier}, ClickedAt: ${new Date().toISOString()}\n`;
    fs.appendFile('clicks_log.txt', logEntry, err => {
        if (err) {
            console.error('Error logging click:', err);
            res.status(500).send('Error logging click');
        } else {
            console.log(`Notification clicked: ${notificationId}`);
            res.status(200).send('Click logged');
        }
    });
});

app.get('/track-click/:siteCode', dynamicCors, (req, res) => {
    var notificationId = req.query.notificationId;
    var siteIdentifier = req.query.siteIdentifier;
    var siteCode = req.params.siteCode;

    // Append click information to a file
    const logEntry = `NotificationId: ${notificationId}, SiteIdentifier: ${siteIdentifier}, SiteCode: ${siteCode}, ClickedAt: ${new Date().toISOString()}\n`;
    fs.appendFile('clicks_log.txt', logEntry, err => {
        if (err) {
            console.error('Error logging click:', err);
            res.status(500).send('Error logging click');
        } else {
            console.log(`Notification clicked: ${notificationId}`);
            res.status(200).send('Click logged');
        }
    });
});

// Define the database name
const databaseName = process.env.DB_NAME;

// Function to create and configure database tables
async function createDatabaseTables() {
  try {
      // Connect to the database
      const connection = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
      });

      console.log('Connected to MySQL');

      // Create the database if it doesn't exist
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${databaseName}`);

      console.log(`Database ${databaseName} checked/created`);

      // Close the connection
      await connection.end();

      // Now, establish a connection to the specific database
      const dbConnection = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: databaseName, // Use the defined database name
      });

      // Create the 'sites' table
      const createSitesTableQuery = `
        CREATE TABLE IF NOT EXISTS sites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            siteCode VARCHAR(255) NOT NULL,
            domain VARCHAR(255) NOT NULL,
            siteIdentifier VARCHAR(255) NOT NULL
        );`;

      await dbConnection.query(createSitesTableQuery);

      console.log('sites table checked/created');

      // Create the 'subscribers' table
      const createSubscribersTableQuery = `
          CREATE TABLE IF NOT EXISTS subscribers (
              id INT AUTO_INCREMENT PRIMARY KEY,
              endpoint VARCHAR(255) NOT NULL,
              subscriptionKeys TEXT NOT NULL,
              domain VARCHAR(255) NOT NULL
          );`;

      await dbConnection.query(createSubscribersTableQuery);

      console.log('subscribers table checked/created');

      // Create the 'users' table with a default value for the 'role' column
      const createUsersTableQuery = `
          CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(255) NOT NULL,
              email VARCHAR(255) NOT NULL,
              password VARCHAR(255) NOT NULL,
              role VARCHAR(255) NOT NULL DEFAULT 'site-access'  -- Set default value to 'site-access'
          );`;

      await dbConnection.query(createUsersTableQuery);

      console.log('users table checked/created');

      // Create the 'user_sites' table to manage which sites a user has access to
      const createUserSitesTableQuery = `
          CREATE TABLE IF NOT EXISTS user_sites (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT,
              site_identifier VARCHAR(255),
              FOREIGN KEY (user_id) REFERENCES users(id),
              FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
          );`;

      await dbConnection.query(createUserSitesTableQuery);

      console.log('user_sites table checked/created');

      // Close the database connection
      await dbConnection.end();
  } catch (error) {
      console.error('Error creating database tables:', error);
  }
}

// Connect to the database and create tables
mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
}).then((connection) => {
    console.log('Connected to MySQL');
    createDatabaseTables().then(() => {
        // Close the initial connection
        connection.end();
    });
}).catch((error) => {
    console.error('Error connecting to MySQL:', error);
});

// Route to display the form, restricted to "administrator" role
app.get('/create-push', checkUserRole, (req, res) => {
    res.send(`
        <form action="/create-push" method="post">
            <label for="siteCode">Site Code:</label>
            <input type="text" id="siteCode" name="siteCode" required />
            <button type="submit">Submit</button>
        </form>`
    );
});

// Route to handle form submission
app.post('/create-push', checkUserRole, (req, res) => {
    const siteCode = req.body.siteCode || ''; // Fallback to an empty string if null or undefined
    const domain = `https://${siteCode}.solutiosoftware.com`;
    const siteIdentifier = uuidv4().substring(0, 10); // Generate a 10-digit key

    // Query to check if siteCode already exists
    const checkQuery = 'SELECT * FROM sites WHERE siteCode = ?';
    connection.query(checkQuery, [siteCode], (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Error querying the database');
        }

        if (results.length > 0) {
            // siteCode already exists
            return res.send('Site code already exists in the database');
        } else {
            // Insert new siteCode
            const insertQuery = 'INSERT INTO sites (siteCode, domain, siteIdentifier) VALUES (?, ?, ?)';
            connection.query(insertQuery, [siteCode, domain, siteIdentifier], (insertErr, insertResults) => {
                if (insertErr) {
                    console.error('Error inserting into the database:', insertErr);
                    return res.status(500).send('Error inserting into the database');
                }

                res.send('Site code added to the database');
            });
        }
    });
});

app.get('/api/get-all-site-codes', (req, res) => {
    // Assuming 'sites' is the name of your table
    connection.query('SELECT siteCode, siteIdentifier FROM sites', (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Error querying the database');
        }

        // Send the results as a JSON response
        res.json(results);
    });
});

/*app.get('/all-sites', checkUserRole, (req, res) => {
    const query = 'SELECT * FROM sites'; // Assuming 'sites' is your table name
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Error querying the database');
        }

        let sitesHtmlContent = results.map(site => `<div>${site.siteCode}</div>`).join('');

        // Read the HTML file
        fs.readFile(path.join(__dirname, 'public', 'sites.html'), 'utf8', (err, htmlContent) => {
            if (err) {
                console.error('Error reading HTML file:', err);
                return res.status(500).send('Error reading HTML file');
            }

            // Inject site codes into the HTML content
            htmlContent = htmlContent.replace('<!-- Site codes will be inserted here -->', sitesHtmlContent);

            // Send the modified HTML content as the response
            res.send(htmlContent);
        });
    });
});*/

// Function to send a test push notification to a single subscription
function sendTestNotification(subscription) {
    const payload = JSON.stringify({ title: 'Test Notification', body: 'This is a test message.' });

    webPush.sendNotification(subscription, payload)
        .then(result => console.log('Test notification sent:', result))
        .catch(error => console.error('Error sending test notification:', error));
}

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT})`));