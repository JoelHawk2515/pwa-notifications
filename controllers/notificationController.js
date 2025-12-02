const webPush = require('web-push');
const mysql = require('mysql2/promise');
const { connectToDatabase } = require('../dbSetup');
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

    // Apply dynamic CORS
    await dynamicCors(req, res, () => {});  // Call dynamicCors to set CORS headers dynamically

    // Ensure subscription data is valid
    if (!endpoint || !keys || !domain || !site_identifier) {
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
            return res.status(409).send('Subscription already exists');
        }

        // Insert the new subscription into the database
        await connection.query(
            'INSERT INTO subscribers (endpoint, subscriptionKeys, domain, site_identifier) VALUES (?, ?, ?, ?)',
            [endpoint, subscriptionKeys, domain, site_identifier]
        );

        console.log('Subscription saved:', endpoint);

        // Return a response with the site_identifier
        return res.status(201).json({
            message: 'Subscription saved',
            site_identifier: site_identifier  // Return site_identifier with the response
        });
    } catch (err) {
        console.error('Error saving subscription:', err);
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
    const { siteIdentifier, title, body, icon, badge, image, tag, silent, url, notificationId } = req.body;

    console.log('Received request body:', req.body);  // Log received data

    // Validate siteIdentifier presence
    if (!siteIdentifier) {
        console.error('Site identifier is required');
        return res.status(400).send('Site identifier is required');
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        console.log('Running query to get domain for siteIdentifier:', siteIdentifier);
        const [siteResults] = await connection.query('SELECT domain FROM subscribers WHERE site_identifier = ?', [siteIdentifier]);

        if (siteResults.length === 0) {
            console.log('Site identifier not found:', siteIdentifier);
            return res.status(404).send('Site identifier not found');
        }
        
        // Construct the targetDomain by appending ".solutiosoftware.com" to the siteIdentifier
        const targetDomain = `${siteIdentifier}.solutiosoftware.com`.replace(/^https?:\/\//, '');
        console.log('Resolved targetDomain:', targetDomain);
        
        // Now query the subscribers using the modified targetDomain
        const [subscribers] = await connection.query('SELECT id, endpoint, subscriptionKeys FROM subscribers WHERE domain = ?', [targetDomain]);
        
        if (subscribers.length === 0) {
            console.log('No subscribers found for domain:', targetDomain);
            return res.status(404).send('No subscribers found for this domain');
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
                        id: notificationId,  // notification_id sent with the notification
                        userId: subscriber.id,      // user_id sent with the notification
                    }
                });

                console.log('Sending notification to endpoint:', subscription.endpoint);
                await webPush.sendNotification(subscription, notificationPayload);
                console.log('Notification sent successfully to endpoint:', subscription.endpoint);
            } catch (error) {
                console.error('Error sending notification:', error.message);
                failedNotifications.push({ endpoint: subscriber.endpoint, error: error.message });
            }
        }

        if (failedNotifications.length > 0) {
            console.log('Some notifications failed:', failedNotifications);
            return res.status(500).json({ success: false, message: 'Some notifications failed', failedNotifications });
        }

        console.log('All notifications sent successfully');
        return res.status(200).json({ success: true, message: 'All notifications sent successfully' });
    } catch (err) {
        console.error('Error sending notifications:', err);
        return res.status(500).send('Failed to send notifications');
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

    return result;
}

module.exports = { subscribe, sendNotification, trackPushEvent };