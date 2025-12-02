const fs = require('fs');

// Route to log click information for all site codes
exports.trackClick = (req, res) => {
    const { notificationId, siteIdentifier } = req.query;

    // Append click information to a file
    const logEntry = `NotificationId: ${notificationId}, SiteIdentifier: ${siteIdentifier}, ClickedAt: ${new Date().toISOString()}\n`;
    fs.appendFile('clicks_log.txt', logEntry, err => {
        if (err) {
            console.error('Error logging click:', err);
            res.status(500).send('Error logging click');
        } else {
            console.log(`Notification clicked: ${notificationId}`);
            res.status(200).send('Click logged');
        }
    });
};

// Route to log click information for a specific site code
exports.trackClickWithSiteCode = (req, res) => {
    const { notificationId, siteIdentifier } = req.query;
    const { siteCode } = req.params;

    // Append click information to a file
    const logEntry = `NotificationId: ${notificationId}, SiteIdentifier: ${siteIdentifier}, SiteCode: ${siteCode}, ClickedAt: ${new Date().toISOString()}\n`;
    fs.appendFile('clicks_log.txt', logEntry, err => {
        if (err) {
            console.error('Error logging click:', err);
            res.status(500).send('Error logging click');
        } else {
            console.log(`Notification clicked: ${notificationId}`);
            res.status(200).send('Click logged');
        }
    });
};