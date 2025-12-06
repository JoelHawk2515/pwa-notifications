const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');

// Cache allowed origins to avoid repeated DB queries
let allowedOriginsCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

async function updateAllowedOrigins() {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) return;
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [domains] = await connection.query('SELECT DISTINCT domain FROM site_domains');
    await connection.end();
    allowedOriginsCache = domains.map(row => {
      const d = row.domain.toLowerCase();
      // Support both http and https
      return [`https://${d}`, `http://${d}`];
    }).flat();
    lastCacheUpdate = now;
  } catch (err) {
    console.error('Error updating CORS allowed origins:', err);
  }
}

// Middleware for dynamic CORS handling
const dynamicCors = async (req, res, next) => {
  try {
      const origin = req.headers.origin;

      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else {
        // Update cache if stale
        await updateAllowedOrigins();

        const originLower = origin.toLowerCase();
        const isAllowed = allowedOriginsCache.some(allowed => originLower.startsWith(allowed)) 
          || originLower.includes('localhost') 
          || originLower.includes('127.0.0.1');

        if (isAllowed) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
          return res.status(403).send('Not allowed by CORS');
        }
      }

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
      console.error('Error in CORS middleware:', err);
      res.status(500).send('Internal Server Error');
  }
};

module.exports = { dynamicCors };
