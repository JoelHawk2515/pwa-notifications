// Configuration file to centralize environment settings and constants
const crypto = require('crypto');
require('dotenv').config(); // Load environment variables from .env

// Application constants
const ROUTE = '/app1';
const secretKey = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex'); // Default to a random key if none exists

// MySQL Database Configuration
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

// Web Push Configuration (VAPID Keys)
const publicVapidKey = process.env.PUBLIC_VAPID_KEY || 'BDtroFVwrS-3qQd3wMTBOkSpsH2IBJOAhe588S241mBMaJM3leY318wW6v9_bWvY2WDqgAeQz2Dh3ItCPkw72OY';
const privateVapidKey = process.env.PRIVATE_VAPID_KEY || 'qgEr8-oJ2vFr7H3kDvbMxgjfK4mRJzw2dUeluGFTQTQ';

// Convert VAPID keys to URL-safe base64
function toURLSafeBase64(base64String) {
    return base64String.replace(/\+/g, '-').replace(/\//g, '_');
}

const urlSafePublicVapidKey = toURLSafeBase64(publicVapidKey);
const urlSafePrivateVapidKey = toURLSafeBase64(privateVapidKey);

// Export configuration values
module.exports = {
    ROUTE,
    secretKey,
    dbConfig,
    urlSafePublicVapidKey,
    urlSafePrivateVapidKey,
};