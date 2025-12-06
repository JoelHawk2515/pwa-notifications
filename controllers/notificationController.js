const webPush = require('web-push');
const mysql = require('mysql2/promise');
const { connectToDatabase } = require('../dbSetup');
const { deliverEvent } = require('./webhookController');
const { dynamicCors } = require('../middleware/corsMiddleware');
const { dbConfig } = require('../config/config');

// Set VAPID details for web-push
webPush.setVapidDetails(
  'mailto:jqel.padgett@gmail.com',
  process.env.PUBLIC_VAPID_KEY,
  process.env.PRIVATE_VAPID_KEY
);

// Function to handle the subscription
async function subscribe(req, res) {
    const { endpoint, keys, domain, site_identifier } = req.body;

    console.log('📝 Subscription request received:', { 
        endpoint: endpoint ? endpoint.substring(0, 50) + '...' : 'missing',
        hasKeys: !!keys,
        domain,
        site_identifier
    });

    // Apply dynamic CORS
    await dynamicCors(req, res, () => {});  // Call dynamicCors to set CORS headers dynamically

    // Ensure subscription data is valid
    if (!endpoint || !keys || !domain || !site_identifier) {
        console.warn('❌ Invalid subscription payload', { hasEndpoint: !!endpoint, hasKeys: !!keys, hasDomain: !!domain, hasSiteIdentifier: !!site_identifier });
        return res.status(400).send('Invalid subscription data');
    }

    const subscriptionKeys = JSON.stringify(keys);

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check if the subscription already exists
        const [existingSubscriptions] = await connection.query(
            'SELECT * FROM subscribers WHERE endpoint = ?',
            [endpoint]
        );

        if (existingSubscriptions.length > 0) {
            console.log('ℹ️  Subscription already exists for endpoint');
            return res.status(200).json({ message: 'Subscription already exists', site_identifier });
        }

        // Insert the new subscription into the database
        await connection.query(
            'INSERT INTO subscribers (endpoint, subscriptionKeys, domain, site_identifier) VALUES (?, ?, ?, ?)',
            [endpoint, subscriptionKeys, domain, site_identifier]
        );

        console.log('✅ Subscription saved:', { endpoint: endpoint.substring(0, 50) + '...', domain, site_identifier });

        // Return a response with the site_identifier
        return res.status(201).json({
            message: 'Subscription saved',
            site_identifier: site_identifier
        });
    } catch (err) {
        console.error('❌ Error saving subscription:', err);
        return res.status(500).send('Failed to save subscription');
    }
}

// Function to send notification
/*async function sendNotification(req, res) {
    const { siteCode, title, body, icon, badge, image, tag, silent, url, notificationId } = req.body;

    // Construct siteIdentifier dynamically
    const siteIdentifier = siteCode;

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [siteResults] = await connection.query('SELECT domain FROM sites WHERE siteIdentifier = ?', [siteIdentifier]);

        if (siteResults.length === 0) {
            return res.status(404).send('Site identifier not found');
        }

        const targetDomain = siteResults[0].domain.replace(/^https?:\/\//, '');
        const [subscribers] = await connection.query('SELECT id, endpoint, subscriptionKeys FROM subscribers WHERE domain = ?', [targetDomain]);

        if (subscribers.length === 0) {
            return res.status(404).send('No subscribers found for this domain');
        }

        let failedNotifications = [];
        for (const subscriber of subscribers) {
            try {
                const keys = JSON.parse(subscriber.subscriptionKeys);
                const subscription = {
                    endpoint: subscriber.endpoint,
                    keys: keys
                };

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
                        url: url || '/',
                        id: notificationId,  // Ensure notificationId is included
                    }
                });

                try {
                    await webPush.sendNotification(subscription, notificationPayload);
                } catch (error) {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await connection.query('DELETE FROM subscribers WHERE id = ?', [subscriber.id]);
                    }
                    failedNotifications.push({ endpoint: subscriber.endpoint, error: error.message });
                }
            } catch (err) {
                failedNotifications.push({ endpoint: subscriber.endpoint, error: err.message });
            }
        }

        if (failedNotifications.length > 0) {
            return res.status(500).json({ success: false, message: 'Some notifications failed', failedNotifications });
        }

        return res.status(200).json({ success: true, message: 'All notifications sent successfully' });
    } catch (err) {
        console.error('Error sending notifications:', err);
        return res.status(500).send('Failed to send notifications');
    }
}*/

async function sendNotification(req, res) {
    const { siteIdentifier, title, body, icon, badge, image, tag, silent, url, notificationId, scheduledTime, audienceType } = req.body;

    console.log('Received request body:', req.body);

    // Validate siteIdentifier presence
    if (!siteIdentifier) {
        console.error('Site identifier is required');
        return res.status(400).json({ success: false, message: 'Site identifier is required' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Store notification metadata
        const storedNotificationId = notificationId || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const status = scheduledTime ? 'scheduled' : 'sent';
        const scheduledDateTime = scheduledTime ? 
            `${scheduledTime.date} ${scheduledTime.time}` : null;

        await connection.query(
            `INSERT INTO notifications (notification_id, site_identifier, title, body, icon, image, url, status, scheduled_time, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [storedNotificationId, siteIdentifier, title, body, icon, image, url, status, scheduledDateTime, req.session?.user?.id || null]
        );

        // If scheduled, just store and return success
        if (scheduledTime) {
            console.log('📅 Notification scheduled for:', scheduledDateTime);
            return res.status(200).json({ 
                success: true, 
                message: 'Notification scheduled',
                scheduledFor: scheduledDateTime,
                notificationId: storedNotificationId
            });
        }

        // Immediate send logic
        console.log('Running query to get domain for siteIdentifier:', siteIdentifier);
        const [siteResults] = await connection.query('SELECT domain FROM subscribers WHERE site_identifier = ?', [siteIdentifier]);

        if (siteResults.length === 0) {
            console.log('Site identifier not found:', siteIdentifier);
            return res.status(404).json({ success: false, message: 'Site identifier not found' });
        }
        
        const targetDomain = `${siteIdentifier}.solutiosoftware.com`.replace(/^https?:\/\//, '');
        console.log('Resolved targetDomain:', targetDomain);
        
        // Apply audience filtering
        let subscribersQuery = 'SELECT id, endpoint, subscriptionKeys FROM subscribers WHERE domain = ? OR site_identifier = ?';
        let queryParams = [targetDomain, siteIdentifier];
        
        if (audienceType === 'active') {
            subscribersQuery += ' AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        }
        
        const [subscribers] = await connection.query(subscribersQuery, queryParams);
        
        if (subscribers.length === 0) {
            console.log('No subscribers found for domain:', targetDomain);
            return res.status(404).json({ success: false, message: 'No subscribers found for this domain' });
        }

        let failedNotifications = [];
        console.log('Found subscribers:', subscribers.length);

        for (const subscriber of subscribers) {
            console.log('Processing subscriber:', subscriber.id);

            try {
                const keys = JSON.parse(subscriber.subscriptionKeys);
                const subscription = {
                    endpoint: subscriber.endpoint,
                    keys: keys
                };

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
                        url: url || '/',
                        id: storedNotificationId,
                        userId: subscriber.id,
                    }
                });

                console.log(`[${req.correlationId}] Sending notification to endpoint:`, subscription.endpoint);
                await webPush.sendNotification(subscription, notificationPayload);
                console.log(`[${req.correlationId}] Notification sent successfully to endpoint:`, subscription.endpoint);
                try { require('../server').metrics.sends++; } catch(e) {}
                try {
                    await deliverEvent(siteIdentifier, 'push.sent', {
                        notificationId: storedNotificationId,
                        subscriberId: subscriber.id,
                        correlationId: req.correlationId || null
                    });
                } catch(e) { console.warn('webhook deliverEvent push.sent failed', e.message); }
            } catch (error) {
                console.error('Error sending notification:', error.message);
                failedNotifications.push({ endpoint: subscriber.endpoint, error: error.message });
                try { require('../server').metrics.failures++; } catch(e) {}
            }
        }

        if (failedNotifications.length > 0) {
            console.log('Some notifications failed:', failedNotifications);
            return res.status(500).json({ success: false, message: 'Some notifications failed', failedNotifications, count: subscribers.length - failedNotifications.length });
        }

        console.log('All notifications sent successfully');
        return res.status(200).json({ success: true, message: 'All notifications sent successfully', count: subscribers.length });
    } catch (err) {
        console.error('Error sending notifications:', err);
        return res.status(500).json({ success: false, message: 'Failed to send notifications' });
    }
}

async function trackPushEvent(notificationId, eventType, siteIdentifier, user_id) {
    const connection = await connectToDatabase();

    console.log(siteIdentifier);

    const [result] = await connection.query(
        `INSERT INTO notification_analytics (notification_id, event_type, site_identifier, user_id) 
         VALUES (?, ?, ?, ?)`, 
        [notificationId, eventType, siteIdentifier, user_id]
    );

    try {
        await deliverEvent(siteIdentifier, 'push.event', {
            notificationId,
            eventType,
            userId: user_id
        });
    } catch(e) { console.warn('webhook deliverEvent push.event failed', e.message); }

    return result;
}

// Minimal test send with defaults for quick validation
async function sendTestNotification(siteIdentifier) {
    if (!siteIdentifier) {
        throw new Error('siteIdentifier is required');
    }
    console.log('🔔 Test notification requested for:', siteIdentifier);
    
    const connection = await mysql.createConnection(dbConfig);
    const targetDomain = `${siteIdentifier}.solutiosoftware.com`.replace(/^https?:\/\//, '');
    
    console.log(`🔍 Looking for subscribers with domain: ${targetDomain}`);
    const [subscribers] = await connection.query('SELECT id, endpoint, subscriptionKeys FROM subscribers WHERE domain = ?', [targetDomain]);
    
    console.log(`📊 Found ${subscribers.length} subscriber(s)`);
    
    if (subscribers.length === 0) {
        // Try without the .solutiosoftware.com suffix for localhost testing
        const [localSubs] = await connection.query('SELECT id, endpoint, subscriptionKeys FROM subscribers WHERE domain = ? OR site_identifier = ?', [siteIdentifier, siteIdentifier]);
        if (localSubs.length > 0) {
            console.log(`✅ Found ${localSubs.length} subscriber(s) using site_identifier match`);
            return await processSend(localSubs, siteIdentifier);
        }
        return { message: 'No subscribers for this domain', count: 0 };
    }
    
    return await processSend(subscribers, siteIdentifier);
}

async function processSend(subscribers, siteIdentifier) {
    let failures = [];
    for (const subscriber of subscribers) {
        try {
            const keys = JSON.parse(subscriber.subscriptionKeys);
            const subscription = { endpoint: subscriber.endpoint, keys };
            const payload = JSON.stringify({
                title: 'Test Notification',
                body: 'This is a quick end-to-end test.',
                data: { id: `test-${Date.now()}`, url: '/', siteIdentifier }
            });
            await webPush.sendNotification(subscription, payload);
            console.log('✅ Notification sent to subscriber:', subscriber.id);
            try {
                await deliverEvent(siteIdentifier, 'push.sent', {
                    notificationId: 'test',
                    subscriberId: subscriber.id,
                });
            } catch(e) { console.warn('webhook deliverEvent push.sent (test) failed', e.message); }
        } catch (err) {
            console.error('❌ Failed to send to subscriber:', subscriber.id, err.message);
            failures.push({ endpoint: subscriber.endpoint, error: err.message });
        }
    }
    return { message: failures.length ? 'Some failed' : 'Sent successfully', count: subscribers.length, failures };
}

// Batch operations: pause/resume/resend/delete
async function batchUpdateNotifications(req, res) {
    try {
        const { action, ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        if (action === 'pause') {
            await connection.query(`UPDATE notifications SET status = 'draft' WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        } else if (action === 'resume') {
            await connection.query(`UPDATE notifications SET status = 'scheduled' WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        } else if (action === 'delete') {
            await connection.query(`DELETE FROM notifications WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        } else if (action === 'resend') {
            // Fetch notifications and resend immediately
            const [rows] = await connection.query(`SELECT * FROM notifications WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
            let total = 0;
            for (const n of rows) {
                const result = await sendNotification({ body: { 
                    siteIdentifier: n.site_identifier,
                    title: n.title,
                    body: n.body,
                    icon: n.icon,
                    image: n.image,
                    url: n.url,
                    notificationId: n.notification_id
                } }, { status: ()=>({ json: ()=>{} }), json: ()=>{} });
                total++;
            }
        } else {
            return res.status(400).json({ error: 'Unknown action' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('batchUpdateNotifications error:', err);
        res.status(500).json({ error: 'Batch operation failed' });
    }
}

module.exports = { subscribe, sendNotification, trackPushEvent, sendTestNotification, batchUpdateNotifications };