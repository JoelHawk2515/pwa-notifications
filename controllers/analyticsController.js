const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/config');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

// Get comprehensive analytics for a site
async function getAnalytics(req, res) {
    try {
        const { site_identifier, start_date, end_date } = req.query;
        
        if (!site_identifier) {
            return res.status(400).json({ error: 'site_identifier is required' });
        }

        const dateFilter = start_date && end_date 
            ? `AND n.sent_at BETWEEN ? AND ?`
            : '';
        const params = [site_identifier];
        if (start_date && end_date) {
            params.push(start_date, end_date);
        }

        // Overall metrics
        const connection = await mysql.createConnection(dbConfig);
        const [overallMetrics] = await connection.query(`
            SELECT 
                COUNT(DISTINCT n.id) as total_sent,
                COUNT(DISTINCT CASE WHEN n.status = 'sent' THEN n.id END) as successful,
                COUNT(DISTINCT CASE WHEN n.status = 'failed' THEN n.id END) as failed,
                COUNT(DISTINCT na.id) as total_engagements,
                COUNT(DISTINCT CASE WHEN na.event_type = 'open' THEN na.id END) as total_opens,
                COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.id END) as total_clicks,
                COUNT(DISTINCT CASE WHEN na.event_type = 'conversion' THEN na.id END) as total_conversions
            FROM notifications n
            LEFT JOIN notification_analytics na ON n.id = na.notification_id
            WHERE n.site_identifier = ? ${dateFilter}
        `, params);

        // Time series data (daily aggregates)
        const [timeSeries] = await connection.query(`
            SELECT 
                DATE(n.sent_at) as date,
                COUNT(DISTINCT n.id) as sent_count,
                COUNT(DISTINCT CASE WHEN na.event_type = 'open' THEN na.id END) as opens,
                COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.id END) as clicks
            FROM notifications n
            LEFT JOIN notification_analytics na ON n.id = na.notification_id
            WHERE n.site_identifier = ? ${dateFilter}
            GROUP BY DATE(n.sent_at)
            ORDER BY date DESC
            LIMIT 30
        `, params);

        // Top performing notifications
        const [topNotifications] = await connection.query(`
            SELECT 
                n.id,
                n.notification_id,
                n.title,
                n.body,
                COUNT(DISTINCT na.id) as engagement_count,
                COUNT(DISTINCT CASE WHEN na.event_type = 'open' THEN na.id END) as opens,
                COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.id END) as clicks,
                n.sent_at
            FROM notifications n
            LEFT JOIN notification_analytics na ON n.id = na.notification_id
            WHERE n.site_identifier = ? ${dateFilter}
            GROUP BY n.id
            ORDER BY engagement_count DESC
            LIMIT 10
        `, params);

        // Subscriber engagement stats
        const [subscriberStats] = await connection.query(`
            SELECT 
                COUNT(DISTINCT endpoint) as total_subscribers,
                COUNT(DISTINCT CASE WHEN status = 'active' THEN endpoint END) as active_subscribers,
                COUNT(DISTINCT CASE WHEN status = 'unsubscribed' THEN endpoint END) as unsubscribed,
                COUNT(DISTINCT CASE WHEN status = 'bounced' THEN endpoint END) as bounced
            FROM subscribers
            WHERE domain = ?
        `, [site_identifier]);

        // Calculate rates
        const metrics = overallMetrics[0];
        metrics.success_rate = metrics.total_sent > 0 
            ? ((metrics.successful / metrics.total_sent) * 100).toFixed(2)
            : 0;
        metrics.open_rate = metrics.successful > 0 
            ? ((metrics.total_opens / metrics.successful) * 100).toFixed(2)
            : 0;
        metrics.click_rate = metrics.total_opens > 0 
            ? ((metrics.total_clicks / metrics.total_opens) * 100).toFixed(2)
            : 0;
        metrics.conversion_rate = metrics.total_clicks > 0 
            ? ((metrics.total_conversions / metrics.total_clicks) * 100).toFixed(2)
            : 0;

        res.json({
            success: true,
            data: {
                overall: metrics,
                timeSeries: timeSeries.reverse(), // Chronological order
                topNotifications,
                subscribers: subscriberStats[0]
            }
        });

    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
}

// Get funnel analysis
async function getFunnelAnalysis(req, res) {
    try {
        const { site_identifier, notification_id } = req.query;
        
        if (!site_identifier) {
            return res.status(400).json({ error: 'site_identifier is required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        const notificationFilter = notification_id ? 'AND n.notification_id = ?' : '';
        const params = [site_identifier];
        if (notification_id) params.push(notification_id);

        const [funnelData] = await connection.query(`
            SELECT 
                COUNT(DISTINCT n.id) as sent,
                COUNT(DISTINCT CASE WHEN na.event_type = 'open' THEN na.notification_id END) as opened,
                COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.notification_id END) as clicked,
                COUNT(DISTINCT CASE WHEN na.event_type = 'conversion' THEN na.notification_id END) as converted
            FROM notifications n
            LEFT JOIN notification_analytics na ON n.id = na.notification_id
            WHERE n.site_identifier = ? ${notificationFilter}
        `, params);

        const data = funnelData[0];
        const funnel = [
            { stage: 'Sent', count: data.sent, rate: 100 },
            { stage: 'Opened', count: data.opened, rate: data.sent > 0 ? ((data.opened / data.sent) * 100).toFixed(2) : 0 },
            { stage: 'Clicked', count: data.clicked, rate: data.opened > 0 ? ((data.clicked / data.opened) * 100).toFixed(2) : 0 },
            { stage: 'Converted', count: data.converted, rate: data.clicked > 0 ? ((data.converted / data.clicked) * 100).toFixed(2) : 0 }
        ];

        res.json({ success: true, funnel });

    } catch (error) {
        console.error('Error fetching funnel:', error);
        res.status(500).json({ error: 'Failed to fetch funnel analysis' });
    }
}

// Get cohort analysis
async function getCohortAnalysis(req, res) {
    try {
        const { site_identifier } = req.query;
        
        if (!site_identifier) {
            return res.status(400).json({ error: 'site_identifier is required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        // Group subscribers by subscription week and track engagement
        const [cohortData] = await connection.query(`
            SELECT 
                YEAR(s.subscriptionTime) as year,
                WEEK(s.subscriptionTime) as week,
                COUNT(DISTINCT s.endpoint) as cohort_size,
                COUNT(DISTINCT na.user_id) as engaged_users,
                COUNT(DISTINCT na.id) as total_engagements
            FROM subscribers s
            LEFT JOIN notification_analytics na ON s.id = na.user_id
            WHERE s.domain = ?
            GROUP BY YEAR(s.subscriptionTime), WEEK(s.subscriptionTime)
            ORDER BY year DESC, week DESC
            LIMIT 12
        `, [site_identifier]);

        const cohorts = cohortData.map(cohort => ({
            cohort: `${cohort.year}-W${cohort.week}`,
            size: cohort.cohort_size,
            engaged: cohort.engaged_users,
            engagement_rate: cohort.cohort_size > 0 
                ? ((cohort.engaged_users / cohort.cohort_size) * 100).toFixed(2)
                : 0,
            avg_events_per_user: cohort.engaged_users > 0 
                ? (cohort.total_engagements / cohort.engaged_users).toFixed(2)
                : 0
        }));

        res.json({ success: true, cohorts });

    } catch (error) {
        console.error('Error fetching cohort analysis:', error);
        res.status(500).json({ error: 'Failed to fetch cohort analysis' });
    }
}

// Export analytics to CSV
async function exportAnalytics(req, res) {
    try {
        const { site_identifier, start_date, end_date } = req.query;
        
        if (!site_identifier) {
            return res.status(400).json({ error: 'site_identifier is required' });
        }

        const connection = await mysql.createConnection(dbConfig);
        const dateFilter = start_date && end_date 
            ? `AND n.sent_at BETWEEN ? AND ?`
            : '';
        const params = [site_identifier];
        if (start_date && end_date) {
            params.push(start_date, end_date);
        }

        // Get detailed notification data
        const [notifications] = await connection.query(`
            SELECT 
                n.notification_id,
                n.title,
                n.body,
                n.status,
                n.sent_at,
                COUNT(DISTINCT CASE WHEN na.event_type = 'open' THEN na.id END) as opens,
                COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.id END) as clicks,
                COUNT(DISTINCT CASE WHEN na.event_type = 'conversion' THEN na.id END) as conversions
            FROM notifications n
            LEFT JOIN notification_analytics na ON n.id = na.notification_id
            WHERE n.site_identifier = ? ${dateFilter}
            GROUP BY n.id
            ORDER BY n.sent_at DESC
        `, params);

        // Create CSV file
        const timestamp = new Date().getTime();
        const filename = `analytics_${site_identifier}_${timestamp}.csv`;
        const filepath = path.join(__dirname, '../exports', filename);

        // Ensure exports directory exists
        const exportsDir = path.join(__dirname, '../exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const csvWriter = createObjectCsvWriter({
            path: filepath,
            header: [
                { id: 'notification_id', title: 'Notification ID' },
                { id: 'title', title: 'Title' },
                { id: 'body', title: 'Body' },
                { id: 'status', title: 'Status' },
                { id: 'sent_at', title: 'Sent At' },
                { id: 'opens', title: 'Opens' },
                { id: 'clicks', title: 'Clicks' },
                { id: 'conversions', title: 'Conversions' }
            ]
        });

        await csvWriter.writeRecords(notifications);

        // Send file
        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Clean up file after download
            setTimeout(() => {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }, 60000); // Delete after 1 minute
        });

    } catch (error) {
        console.error('Error exporting analytics:', error);
        res.status(500).json({ error: 'Failed to export analytics' });
    }
}

// Get real-time metrics (for live dashboard updates)
async function getRealTimeMetrics(req, res) {
    try {
        const { site_identifier } = req.query;
        
        if (!site_identifier) {
            // Gracefully return empty metrics if not provided to avoid noisy 400s
            return res.json({ success: true, data: { recent_sent: 0, recent_engagements: 0, recent_opens: 0, recent_clicks: 0, scheduled: 0, timestamp: new Date().toISOString() } });
        }

        const connection = await mysql.createConnection(dbConfig);
        // Get metrics from last hour
        const [recentActivity] = await connection.query(`
            SELECT 
                COUNT(DISTINCT n.id) as recent_sent,
                COUNT(DISTINCT na.id) as recent_engagements,
                COUNT(DISTINCT CASE WHEN na.event_type = 'open' THEN na.id END) as recent_opens,
                COUNT(DISTINCT CASE WHEN na.event_type = 'click' THEN na.id END) as recent_clicks
            FROM notifications n
            LEFT JOIN notification_analytics na ON n.id = na.notification_id
            WHERE n.site_identifier = ?
            AND n.sent_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `, [site_identifier]);

        // Get scheduled notifications count
        const [scheduled] = await connection.query(`
            SELECT COUNT(*) as scheduled_count
            FROM notifications
            WHERE site_identifier = ?
            AND status = 'scheduled'
            AND scheduled_time > NOW()
        `, [site_identifier]);

        res.json({
            success: true,
            data: {
                ...recentActivity[0],
                scheduled: scheduled[0].scheduled_count,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching real-time metrics:', error);
        res.status(500).json({ error: 'Failed to fetch real-time metrics' });
    }
}

module.exports = {
    getAnalytics,
    getFunnelAnalysis,
    getCohortAnalysis,
    exportAnalytics,
    getRealTimeMetrics
};

