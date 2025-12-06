const db = require('../config/config');

async function requireApiKey(req, res, next) {
    try {
        const key = req.headers['x-api-key'];
        if (!key) return res.status(401).json({ error: 'Missing API key' });
        const [rows] = await db.query('SELECT site_identifier, status FROM api_keys WHERE `key` = ?', [key]);
        if (rows.length === 0 || rows[0].status !== 'active') return res.status(403).json({ error: 'Invalid API key' });
        req.apiSiteIdentifier = rows[0].site_identifier;
        next();
    } catch (err) {
        console.error('requireApiKey error:', err);
        res.status(500).json({ error: 'API auth failed' });
    }
}

module.exports = { requireApiKey };
