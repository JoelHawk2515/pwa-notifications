const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');
const { v4: uuidv4 } = require('uuid');
const webpush = require('web-push');
const config = require('../config/config');

// Create a new A/B test
async function createABTest(req, res) {
    try {
        const {
            name,
            site_identifier,
            variant_a_title,
            variant_a_body,
            variant_a_icon,
            variant_a_image,
            variant_a_url,
            variant_b_title,
            variant_b_body,
            variant_b_icon,
            variant_b_image,
            variant_b_url,
            traffic_split
        } = req.body;

        if (!name || !site_identifier || !variant_a_title || !variant_a_body || !variant_b_title || !variant_b_body) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const created_by = req.session.user?.id;
        const split = traffic_split || 0.50;

        const [result] = await connection.query(`
            INSERT INTO ab_tests 
            (name, site_identifier, variant_a_title, variant_a_body, variant_a_icon, variant_a_image, variant_a_url,
             variant_b_title, variant_b_body, variant_b_icon, variant_b_image, variant_b_url,
             traffic_split, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
        `, [
            name, site_identifier,
            variant_a_title, variant_a_body, variant_a_icon, variant_a_image, variant_a_url,
            variant_b_title, variant_b_body, variant_b_icon, variant_b_image, variant_b_url,
            split, created_by
        ]);

        res.json({
            success: true,
            message: 'A/B test created successfully',
            test_id: result.insertId
        });

    } catch (error) {
        console.error('Error creating A/B test:', error);
        res.status(500).json({ error: 'Failed to create A/B test' });
    }
}

// Get all A/B tests for a site
async function getABTests(req, res) {
    try {
        const { site_identifier } = req.query;

        if (!site_identifier) {
            return res.status(400).json({ error: 'site_identifier is required' });
        }

        const [tests] = await connection.query(`
            SELECT 
                t.*,
                u.username as created_by_name,
                (SELECT COUNT(*) FROM ab_test_results WHERE ab_test_id = t.id AND variant = 'A') as variant_a_sends,
                (SELECT COUNT(*) FROM ab_test_results WHERE ab_test_id = t.id AND variant = 'B') as variant_b_sends
            FROM ab_tests t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.site_identifier = ?
            ORDER BY t.created_at DESC
        `, [site_identifier]);

        res.json({ success: true, tests });

    } catch (error) {
        console.error('Error fetching A/B tests:', error);
        res.status(500).json({ error: 'Failed to fetch A/B tests' });
    }
}

// Get A/B test results
async function getABTestResults(req, res) {
    try {
        const { test_id } = req.params;

        // Get test details
        const [tests] = await connection.query('SELECT * FROM ab_tests WHERE id = ?', [test_id]);
        if (tests.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }
        const test = tests[0];

        // Get results for both variants
        const [results] = await connection.query(`
            SELECT 
                variant,
                COUNT(*) as total_sends,
                SUM(CASE WHEN event_type = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN event_type = 'opened' THEN 1 ELSE 0 END) as opened,
                SUM(CASE WHEN event_type = 'clicked' THEN 1 ELSE 0 END) as clicked,
                SUM(CASE WHEN event_type = 'failed' THEN 1 ELSE 0 END) as failed
            FROM ab_test_results
            WHERE ab_test_id = ?
            GROUP BY variant
        `, [test_id]);

        // Calculate metrics for each variant
        const metrics = {};
        results.forEach(r => {
            const variant = r.variant;
            metrics[variant] = {
                sends: r.total_sends,
                delivered: r.delivered,
                opens: r.opened,
                clicks: r.clicked,
                failures: r.failed,
                delivery_rate: r.total_sends > 0 ? ((r.delivered / r.total_sends) * 100).toFixed(2) : 0,
                open_rate: r.delivered > 0 ? ((r.opened / r.delivered) * 100).toFixed(2) : 0,
                click_rate: r.opened > 0 ? ((r.clicked / r.opened) * 100).toFixed(2) : 0
            };
        });

        // Proper significance test: two-proportion z-test on click rates
        let winner = null;
        let confidence = 0;
        if (metrics.A && metrics.B) {
            const nA = metrics.A.opens || 0; // denominator for click rate
            const nB = metrics.B.opens || 0;
            const cA = metrics.A.clicks || 0;
            const cB = metrics.B.clicks || 0;
            if (nA > 0 && nB > 0) {
                const pA = cA / nA;
                const pB = cB / nB;
                const pPool = (cA + cB) / (nA + nB);
                const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
                const z = se > 0 ? (pA - pB) / se : 0;
                // Convert z to (approx) confidence level
                const absZ = Math.abs(z);
                // Map z to confidence roughly: 1.64≈90%, 1.96≈95%, 2.58≈99%
                if (absZ >= 2.58) confidence = 99;
                else if (absZ >= 1.96) confidence = 95;
                else if (absZ >= 1.64) confidence = 90;
                else confidence = Math.round(absZ / 1.64 * 90);
                winner = pA > pB ? 'A' : (pB > pA ? 'B' : null);
            }
        }

        res.json({
            success: true,
            test,
            results: {
                variant_a: metrics.A || {},
                variant_b: metrics.B || {},
                winner,
                confidence: confidence.toFixed(1)
            }
        });

    } catch (error) {
        console.error('Error fetching test results:', error);
        res.status(500).json({ error: 'Failed to fetch test results' });
    }
}

// Start an A/B test (send notifications)
async function startABTest(req, res) {
    try {
        const { test_id } = req.params;

        // Get test details
        const [tests] = await connection.query('SELECT * FROM ab_tests WHERE id = ?', [test_id]);
        if (tests.length === 0) {
            return res.status(404).json({ error: 'Test not found' });
        }
        const test = tests[0];

        // Update test status
        await connection.query(`
            UPDATE ab_tests 
            SET status = 'running', started_at = NOW() 
            WHERE id = ?
        `, [test_id]);

        // Get subscribers for the site
        const [subscribers] = await connection.query(`
            SELECT * FROM subscribers 
            WHERE domain = ? AND status = 'active'
        `, [test.site_identifier]);

        if (subscribers.length === 0) {
            return res.status(400).json({ error: 'No active subscribers found' });
        }

        const vapidDetails = {
            subject: 'mailto:jqel.padgett@gmail.com',
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY,
        };
        webpush.setVapidDetails(
            vapidDetails.subject,
            vapidDetails.publicKey,
            vapidDetails.privateKey
        );

        let variantASends = 0;
        let variantBSends = 0;

        // Send notifications to subscribers
        for (const subscriber of subscribers) {
            try {
                // Determine which variant to send based on traffic split
                const variant = Math.random() < test.traffic_split ? 'A' : 'B';
                const isVariantA = variant === 'A';

                const notification = {
                    title: isVariantA ? test.variant_a_title : test.variant_b_title,
                    body: isVariantA ? test.variant_a_body : test.variant_b_body,
                    icon: isVariantA ? test.variant_a_icon : test.variant_b_icon,
                    image: isVariantA ? test.variant_a_image : test.variant_b_image,
                    data: {
                        url: isVariantA ? test.variant_a_url : test.variant_b_url,
                        notification_id: uuidv4(),
                        ab_test_id: test_id,
                        variant: variant
                    }
                };

                const subscriptionObject = {
                    endpoint: subscriber.endpoint,
                    keys: {
                        p256dh: subscriber.p256dh,
                        auth: subscriber.auth,
                    },
                };

                await webpush.sendNotification(subscriptionObject, JSON.stringify(notification));

                // Log result
                await connection.query(`
                    INSERT INTO ab_test_results 
                    (ab_test_id, variant, notification_id, subscriber_endpoint, event_type)
                    VALUES (?, ?, ?, ?, 'sent')
                `, [test_id, variant, notification.data.notification_id, subscriber.endpoint]);

                if (isVariantA) variantASends++;
                else variantBSends++;

            } catch (error) {
                console.error(`Failed to send to ${subscriber.endpoint}:`, error);
                
                // Log failure
                await connection.query(`
                    INSERT INTO ab_test_results 
                    (ab_test_id, variant, notification_id, subscriber_endpoint, event_type)
                    VALUES (?, ?, ?, ?, 'failed')
                `, [test_id, 'A', '', subscriber.endpoint]);
            }
        }

        res.json({
            success: true,
            message: 'A/B test started successfully',
            stats: {
                total: subscribers.length,
                variant_a: variantASends,
                variant_b: variantBSends
            }
        });

    } catch (error) {
        console.error('Error starting A/B test:', error);
        res.status(500).json({ error: 'Failed to start A/B test' });
    }
}

// Stop an A/B test
async function stopABTest(req, res) {
    try {
        const { test_id } = req.params;
        const { winner } = req.body;

        await connection.query(`
            UPDATE ab_tests 
            SET status = 'completed', completed_at = NOW(), winner = ?
            WHERE id = ?
        `, [winner || null, test_id]);

        res.json({
            success: true,
            message: 'A/B test stopped successfully'
        });

    } catch (error) {
        console.error('Error stopping A/B test:', error);
        res.status(500).json({ error: 'Failed to stop A/B test' });
    }
}

// Track A/B test events (opened, clicked)
async function trackABTestEvent(req, res) {
    try {
        const { notification_id, event_type } = req.body;

        if (!notification_id || !event_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find the test result entry
        const [existing] = await connection.query(`
            SELECT * FROM ab_test_results 
            WHERE notification_id = ?
            ORDER BY id DESC LIMIT 1
        `, [notification_id]);

        if (existing.length > 0) {
            // Update or insert event
            await connection.query(`
                INSERT INTO ab_test_results 
                (ab_test_id, variant, notification_id, subscriber_endpoint, event_type)
                VALUES (?, ?, ?, ?, ?)
            `, [
                existing[0].ab_test_id,
                existing[0].variant,
                notification_id,
                existing[0].subscriber_endpoint,
                event_type
            ]);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Error tracking A/B test event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
}

module.exports = {
    createABTest,
    getABTests,
    getABTestResults,
    startABTest,
    stopABTest,
    trackABTestEvent
};


