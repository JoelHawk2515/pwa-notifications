const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');

// Rate limiter for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true,
});

// Rate limiter for notification sending
const sendLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 sends per minute
    message: 'Too many notifications sent, please slow down.',
});

// Sanitize HTML input to prevent XSS
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return sanitizeHtml(input, {
            allowedTags: [], // Strip all HTML tags
            allowedAttributes: {},
            disallowedTagsMode: 'discard'
        });
    }
    return input;
}

// Middleware to sanitize request body
function sanitizeBody(req, res, next) {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        });
    }
    next();
}

// Validate notification payload
function validateNotificationPayload(req, res, next) {
    const { siteIdentifier, title, body } = req.body;

    if (!siteIdentifier || typeof siteIdentifier !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid site identifier' });
    }

    if (!title || typeof title !== 'string' || title.length === 0 || title.length > 100) {
        return res.status(400).json({ success: false, message: 'Title must be between 1 and 100 characters' });
    }

    if (!body || typeof body !== 'string' || body.length === 0 || body.length > 300) {
        return res.status(400).json({ success: false, message: 'Body must be between 1 and 300 characters' });
    }

    // Validate URLs if provided
    const urlFields = ['icon', 'image', 'url'];
    for (const field of urlFields) {
        if (req.body[field]) {
            try {
                new URL(req.body[field]);
            } catch (e) {
                return res.status(400).json({ success: false, message: `Invalid ${field} URL` });
            }
        }
    }

    next();
}

// Check if user is admin
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user || req.session.user.role !== 'administrator') {
        return res.status(403).json({ success: false, message: 'Administrator access required' });
    }
    next();
}

// Check if user is authenticated
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    next();
}

module.exports = {
    apiLimiter,
    authLimiter,
    sendLimiter,
    sanitizeInput,
    sanitizeBody,
    validateNotificationPayload,
    requireAdmin,
    requireAuth
};
