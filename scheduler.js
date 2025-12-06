const cron = require('node-cron');
const mysql = require('mysql2/promise');
const webPush = require('web-push');
const { dbConfig } = require('./config/config');

class NotificationScheduler {
    constructor() {
        this.isRunning = false;
        this.task = null;
    }

    async sendScheduledNotification(notification, connection) {
        console.log('📅 Processing scheduled notification:', notification.notification_id);
        
        try {
            // Determine target domain
            const targetDomain = `${notification.site_identifier}.solutiosoftware.com`.replace(/^https?:\/\//, '');
            
            // Get subscribers
            const [subscribers] = await connection.query(
                'SELECT id, endpoint, subscriptionKeys FROM subscribers WHERE domain = ? OR site_identifier = ?',
                [targetDomain, notification.site_identifier]
            );

            if (subscribers.length === 0) {
                console.log('⚠️  No subscribers found for:', notification.site_identifier);
                await connection.query(
                    'UPDATE notifications SET status = ? WHERE id = ?',
                    ['failed', notification.id]
                );
                return { success: false, reason: 'no_subscribers' };
            }

            let successCount = 0;
            let failureCount = 0;

            // Send to each subscriber
            for (const subscriber of subscribers) {
                try {
                    const keys = JSON.parse(subscriber.subscriptionKeys);
                    const subscription = {
                        endpoint: subscriber.endpoint,
                        keys: keys
                    };

                    const payload = JSON.stringify({
                        siteIdentifier: notification.site_identifier,
                        title: notification.title || 'Notification',
                        body: notification.body || '',
                        icon: notification.icon || '',
                        image: notification.image || '',
                        data: {
                            url: notification.url || '/',
                            id: notification.notification_id,
                            userId: subscriber.id
                        }
                    });

                    await webPush.sendNotification(subscription, payload);
                    successCount++;
                    console.log('✅ Sent to subscriber:', subscriber.id);
                } catch (error) {
                    failureCount++;
                    console.error('❌ Failed to send to subscriber:', subscriber.id, error.message);
                    
                    // Remove invalid subscriptions (410 Gone or 404 Not Found)
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await connection.query('DELETE FROM subscribers WHERE id = ?', [subscriber.id]);
                        console.log('🗑️  Removed invalid subscription:', subscriber.id);
                    }
                }
            }

            // Update notification status
            const finalStatus = failureCount === subscribers.length ? 'failed' : 'sent';
            await connection.query(
                'UPDATE notifications SET status = ?, sent_at = NOW() WHERE id = ?',
                [finalStatus, notification.id]
            );

            console.log(`📊 Notification ${notification.notification_id}: ${successCount} sent, ${failureCount} failed`);
            return { success: true, sent: successCount, failed: failureCount };

        } catch (error) {
            console.error('❌ Error processing scheduled notification:', error);
            await connection.query(
                'UPDATE notifications SET status = ? WHERE id = ?',
                ['failed', notification.id]
            );
            return { success: false, reason: error.message };
        }
    }

    async processScheduledNotifications() {
        if (this.isRunning) {
            console.log('⏭️  Scheduler already running, skipping this cycle');
            return;
        }

        this.isRunning = true;
        const connection = await mysql.createConnection(dbConfig);

        try {
            // Find notifications due for sending
            const [pendingNotifications] = await connection.query(
                `SELECT * FROM notifications 
                 WHERE status = 'scheduled' 
                 AND scheduled_time <= NOW() 
                 ORDER BY scheduled_time ASC`
            );

            if (pendingNotifications.length > 0) {
                console.log(`🔔 Found ${pendingNotifications.length} notification(s) to send`);
                
                for (const notification of pendingNotifications) {
                    await this.sendScheduledNotification(notification, connection);
                }
            }
        } catch (error) {
            console.error('❌ Scheduler error:', error);
        } finally {
            await connection.end();
            this.isRunning = false;
        }
    }

    start() {
        if (this.task) {
            console.log('⚠️  Scheduler already started');
            return;
        }

        console.log('🚀 Starting notification scheduler (runs every minute)');
        
        // Run immediately on start
        this.processScheduledNotifications();

        // Then run every minute
        this.task = cron.schedule('* * * * *', () => {
            this.processScheduledNotifications();
        });

        console.log('✅ Scheduler started successfully');
    }

    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
            console.log('🛑 Scheduler stopped');
        }
    }

    getStatus() {
        return {
            running: this.task !== null,
            processing: this.isRunning
        };
    }
}

// Export singleton instance
const scheduler = new NotificationScheduler();
module.exports = scheduler;
