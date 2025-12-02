const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config'); // Import database configuration

// Function to connect to the database
async function connectToDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  return connection;
}

// Middleware for dynamic CORS handling
const dynamicCors = async (req, res, next) => {
  try {
      const siteCode = req.body.site_identifier || ''; // Use site_identifier from the body

      // Connect to the database
      const connection = await connectToDatabase(); 

      // Query the database for the domain associated with the siteCode
      const [results] = await connection.query('SELECT domain FROM sites WHERE siteCode = ?', [siteCode]);

      if (results.length === 0) {
          return res.status(404).send('Site code not found');
      }

      const domain = results[0].domain;

      // Set CORS headers dynamically based on the site's domain
      res.setHeader('Access-Control-Allow-Origin', `${domain}`);  // Ensure full origin is used
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Authorization');

      // If the request method is OPTIONS, respond immediately to preflight requests
      if (req.method === 'OPTIONS') {
          return res.status(204).end();
      }

      // Continue to the next middleware or route handler
      next();
  } catch (err) {
      console.error('Error querying the database:', err);
      res.status(500).send('Internal Server Error');
  }
};

module.exports = { dynamicCors };
