const greenlock = require('greenlock-express');
const express = require('express');
const session = require('express-session');
const webPush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
//const ROUTE = '/app1';
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { dynamicCors } = require('./middleware/corsMiddleware');
const dbSetup = require('./dbSetup');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const siteRoutes = require('./routes/siteRoutes');
const userRoutes = require('./routes/userRoutes');
const { checkUserRole } = require('./middleware/authMiddleware');
const { dbConfig, secretKey, urlSafePublicVapidKey, urlSafePrivateVapidKey, ROUTE } = require('./config/config');

dbSetup.createDatabaseTables();

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

// Apply global CORS middleware for all routes
app.use(cors({
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Allow credentials
  optionsSuccessStatus: 204, // For handling preflight responses
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Use body-parser for handling JSON payloads
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use(dynamicCors);

// Use routes
app.use('/', authRoutes);
app.use('/', notificationRoutes);
app.use('/', siteRoutes);
app.use('/', userRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));