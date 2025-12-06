const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');
const crypto = require('crypto');
const fetch = require('node-fetch');

function signPayload(secret, payload) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
}

async function registerWebhook(req, res) {
    try {
        const { site_identifier, target_url, event_types, secret } = req.body;
        if (!site_identifier || !target_url || !event_types || !secret) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        await connection.query(
            'INSERT INTO webhooks (site_identifier, target_url, event_types, secret) VALUES (?, ?, ?, ?)',
            [site_identifier, target_url, event_types.join(','), secret]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('registerWebhook error:', err);
        res.status(500).json({ error: 'Failed to register webhook' });
    }
}

async function listWebhooks(req, res) {
    try {
        const { site_identifier } = req.query;
        const [rows] = await connection.query('SELECT * FROM webhooks WHERE site_identifier = ?', [site_identifier]);
        res.json({ success: true, webhooks: rows });
    } catch (err) {
        console.error('listWebhooks error:', err);
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
}

async function deliverEvent(site_identifier, type, body) {
    const [hooks] = await connection.query('SELECT * FROM webhooks WHERE site_identifier = ? AND status = "active"', [site_identifier]);
    for (const hook of hooks) {
        if (!hook.event_types.split(',').includes(type)) continue;
        const payload = JSON.stringify({ type, body, timestamp: new Date().toISOString() });
        const signature = signPayload(hook.secret, payload);
        let attempt = 0;
        let delay = 1000;
        while (attempt < 5) {
            try {
                const resp = await fetch(hook.target_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
                    body: payload
                });
                if (resp.ok) {
                    await connection.query('UPDATE usage_daily SET webhook_calls = webhook_calls + 1 WHERE site_identifier = ? AND date = CURDATE()', [site_identifier]);
                    break;
                } else {
                    throw new Error('Non-200 response');
                }
            } catch (err) {
                attempt++;
                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
            }
        }
    }
}

module.exports = { registerWebhook, listWebhooks, deliverEvent };


