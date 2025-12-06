const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');

async function listSubscribers(req, res) {
    try {
        const { site_identifier, status, q } = req.query;
        if (!site_identifier) return res.status(400).json({ error: 'site_identifier required' });
        
        const connection = await mysql.createConnection(dbConfig);
        // Ensure subscribers table exists with minimum columns needed
                await connection.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
              id INT AUTO_INCREMENT PRIMARY KEY,
              endpoint TEXT NOT NULL,
              p256dh TEXT NULL,
              auth TEXT NULL,
              userAgent VARCHAR(512) NULL,
              subscriptionTime DATETIME NULL,
              status VARCHAR(50) DEFAULT 'active',
                            tags TEXT NULL,
              domain VARCHAR(255) NULL,
              site_identifier VARCHAR(255) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        let where = 'WHERE domain = ? OR site_identifier = ?';
        const params = [site_identifier, site_identifier];
        if (status) { where += ' AND status = ?'; params.push(status); }
        if (q) { where += ' AND (endpoint LIKE ? OR userAgent LIKE ?)'; params.push('%'+q+'%', '%'+q+'%'); }
        
        const [subs] = await connection.query(`
            SELECT id, endpoint, userAgent, subscriptionTime, status, tags
            FROM subscribers
            ${where}
            ORDER BY subscriptionTime DESC
            LIMIT 200
        `, params);
        res.json({ success: true, subscribers: subs });
    } catch (err) {
        console.error('listSubscribers error:', err);
        res.status(500).json({ error: 'Failed to list subscribers' });
    }
}

async function updateSubscriberStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('UPDATE subscribers SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('updateSubscriberStatus error:', err);
        res.status(500).json({ error: 'Failed to update subscriber' });
    }
}

async function deleteSubscriber(req, res) {
    try {
        const { id } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('DELETE FROM subscribers WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('deleteSubscriber error:', err);
        res.status(500).json({ error: 'Failed to delete subscriber' });
    }
}

module.exports = { listSubscribers, updateSubscriberStatus, deleteSubscriber };


