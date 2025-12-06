const mysql = require('mysql2/promise');
const { dbConfig } = require('./config/config'); // Ensure that dbConfig is imported from your config file

// Define the database name
const databaseName = dbConfig.database;

// Function to connect to the database
async function connectToDatabase() {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
}

// Function to create and configure database tables
async function createDatabaseTables() {
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
        });

        console.log('Connected to MySQL');

        // Create the database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        console.log(`Database ${dbConfig.database} checked/created`);

        await connection.end();

        // Now, establish a connection to the specific database
        const dbConnection = await mysql.createConnection(dbConfig);

        // Create the 'sites' table
        const createSitesTableQuery = `
            CREATE TABLE IF NOT EXISTS sites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                siteCode VARCHAR(255) NOT NULL,
                domain VARCHAR(255) NOT NULL,
                siteIdentifier VARCHAR(255) NOT NULL,
                UNIQUE (siteIdentifier)  -- Ensure that siteIdentifier is unique
            );
        `;
        await dbConnection.query(createSitesTableQuery);
        console.log('Sites table checked/created');

        // Check if the index on siteIdentifier already exists, if not, create it
        const checkIndexQuery = `
            SELECT COUNT(*) AS index_count
            FROM information_schema.statistics
            WHERE table_schema = ? AND table_name = 'sites' AND index_name = 'idx_siteIdentifier';
        `;
        const [indexCheckResult] = await dbConnection.query(checkIndexQuery, [dbConfig.database]);

        if (indexCheckResult[0].index_count === 0) {
            // Index doesn't exist, so we create it
            const createIndexQuery = 'CREATE INDEX idx_siteIdentifier ON sites(siteIdentifier);';
            await dbConnection.query(createIndexQuery);
            console.log('Index on siteIdentifier added successfully');
        } else {
            console.log('Index on siteIdentifier already exists');
        }

        // Create the 'subscribers' table
        const createSubscribersTableQuery = `
            CREATE TABLE IF NOT EXISTS subscribers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                endpoint VARCHAR(255) NOT NULL,
                subscriptionKeys TEXT NOT NULL,
                domain VARCHAR(255) NOT NULL,
                site_identifier VARCHAR(255) NULL
            );
        `;
        await dbConnection.query(createSubscribersTableQuery);
        console.log('Subscribers table checked/created');

        // Create the 'users' table
        const createUsersTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(255) NOT NULL DEFAULT 'site-access',
                first_name VARCHAR(255) NULL,
                last_name VARCHAR(255) NULL
            );
        `;
        await dbConnection.query(createUsersTableQuery);
        console.log('Users table checked/created');
    // Ensure columns exist if tables were created previously
        // Conditionally add columns if missing (MySQL before 8.0 does not support IF NOT EXISTS on ADD COLUMN)
        const [subsCols] = await dbConnection.query("SHOW COLUMNS FROM subscribers LIKE 'site_identifier'");
        if (subsCols.length === 0) {
            await dbConnection.query("ALTER TABLE subscribers ADD COLUMN site_identifier VARCHAR(255) NULL");
        }
        const [userFirst] = await dbConnection.query("SHOW COLUMNS FROM users LIKE 'first_name'");
        if (userFirst.length === 0) {
            await dbConnection.query("ALTER TABLE users ADD COLUMN first_name VARCHAR(255) NULL");
        }
        const [userLast] = await dbConnection.query("SHOW COLUMNS FROM users LIKE 'last_name'");
        if (userLast.length === 0) {
            await dbConnection.query("ALTER TABLE users ADD COLUMN last_name VARCHAR(255) NULL");
        }

        // Create the 'user_sites' table
        const createUserSitesTableQuery = `
            CREATE TABLE IF NOT EXISTS user_sites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                site_identifier VARCHAR(255),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createUserSitesTableQuery);
        console.log('User_sites table checked/created');

        // Create the 'notifications' table
        const createNotificationsTableQuery = `
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                notification_id VARCHAR(255) UNIQUE,
                site_identifier VARCHAR(255),
                title VARCHAR(255),
                body TEXT,
                icon VARCHAR(500),
                image VARCHAR(500),
                url VARCHAR(500),
                status ENUM('draft', 'scheduled', 'sent', 'failed') DEFAULT 'sent',
                scheduled_time DATETIME NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INT,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createNotificationsTableQuery);
        console.log('Notifications table checked/created');

        // Add Sprint 2/3 columns to notifications table if missing
        const [notifId] = await dbConnection.query("SHOW COLUMNS FROM notifications LIKE 'notification_id'");
        if (notifId.length === 0) {
            await dbConnection.query("ALTER TABLE notifications ADD COLUMN notification_id VARCHAR(255) UNIQUE AFTER id");
        }
        const [notifStatus] = await dbConnection.query("SHOW COLUMNS FROM notifications LIKE 'status'");
        if (notifStatus.length === 0) {
            await dbConnection.query("ALTER TABLE notifications ADD COLUMN status ENUM('draft', 'scheduled', 'sent', 'failed') DEFAULT 'sent'");
        }
        const [notifScheduled] = await dbConnection.query("SHOW COLUMNS FROM notifications LIKE 'scheduled_time'");
        if (notifScheduled.length === 0) {
            await dbConnection.query("ALTER TABLE notifications ADD COLUMN scheduled_time DATETIME NULL");
        }
        const [notifCreatedBy] = await dbConnection.query("SHOW COLUMNS FROM notifications LIKE 'created_by'");
        if (notifCreatedBy.length === 0) {
            await dbConnection.query("ALTER TABLE notifications ADD COLUMN created_by INT, ADD FOREIGN KEY (created_by) REFERENCES users(id)");
        }

        // Create the 'notification_analytics' table with site_identifier
        const createNotificationAnalyticsTableQuery = `
            CREATE TABLE IF NOT EXISTS notification_analytics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                notification_id INT NOT NULL,
                user_id INT NOT NULL,
                event_type ENUM('open', 'click', 'conversion') NOT NULL,
                site_identifier VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (notification_id) REFERENCES notifications(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createNotificationAnalyticsTableQuery);
        console.log('Notification_analytics table checked/created');

        // Create the 'notification_templates' table
        const createNotificationTemplatesTableQuery = `
            CREATE TABLE IF NOT EXISTS notification_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                site_identifier VARCHAR(255),
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                icon VARCHAR(500),
                image VARCHAR(500),
                url VARCHAR(500),
                tags VARCHAR(255),
                is_global BOOLEAN DEFAULT FALSE,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createNotificationTemplatesTableQuery);
        console.log('Notification_templates table checked/created');

        // Create the 'ab_tests' table for A/B testing
        const createABTestsTableQuery = `
            CREATE TABLE IF NOT EXISTS ab_tests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                site_identifier VARCHAR(255) NOT NULL,
                variant_a_title VARCHAR(255) NOT NULL,
                variant_a_body TEXT NOT NULL,
                variant_a_icon VARCHAR(500),
                variant_a_image VARCHAR(500),
                variant_a_url VARCHAR(500),
                variant_b_title VARCHAR(255) NOT NULL,
                variant_b_body TEXT NOT NULL,
                variant_b_icon VARCHAR(500),
                variant_b_image VARCHAR(500),
                variant_b_url VARCHAR(500),
                traffic_split DECIMAL(3,2) DEFAULT 0.50,
                status ENUM('draft', 'running', 'paused', 'completed') DEFAULT 'draft',
                winner VARCHAR(10) NULL,
                started_at TIMESTAMP NULL,
                completed_at TIMESTAMP NULL,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createABTestsTableQuery);
        console.log('AB_tests table checked/created');

        // Create the 'ab_test_results' table for tracking A/B test performance
        const createABTestResultsTableQuery = `
            CREATE TABLE IF NOT EXISTS ab_test_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ab_test_id INT NOT NULL,
                variant VARCHAR(1) NOT NULL,
                notification_id VARCHAR(255) NOT NULL,
                subscriber_endpoint TEXT NOT NULL,
                event_type ENUM('sent', 'delivered', 'opened', 'clicked', 'failed') NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE CASCADE,
                INDEX idx_test_variant (ab_test_id, variant),
                INDEX idx_timestamp (timestamp)
            );
        `;
        await dbConnection.query(createABTestResultsTableQuery);
        console.log('AB_test_results table checked/created');

        // Create the 'subscriber_segments' table
        const createSubscriberSegmentsTableQuery = `
            CREATE TABLE IF NOT EXISTS subscriber_segments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                site_identifier VARCHAR(255) NOT NULL,
                description TEXT,
                filter_criteria JSON,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createSubscriberSegmentsTableQuery);
        console.log('Subscriber_segments table checked/created');

        // Add metadata columns to subscribers table if missing
        const [subMetadata] = await dbConnection.query("SHOW COLUMNS FROM subscribers LIKE 'metadata'");
        if (subMetadata.length === 0) {
            await dbConnection.query("ALTER TABLE subscribers ADD COLUMN metadata JSON NULL");
        }
        const [subTags] = await dbConnection.query("SHOW COLUMNS FROM subscribers LIKE 'tags'");
        if (subTags.length === 0) {
            await dbConnection.query("ALTER TABLE subscribers ADD COLUMN tags VARCHAR(500) NULL");
        }
        const [subStatus] = await dbConnection.query("SHOW COLUMNS FROM subscribers LIKE 'status'");
        if (subStatus.length === 0) {
            await dbConnection.query("ALTER TABLE subscribers ADD COLUMN status ENUM('active', 'inactive', 'bounced', 'unsubscribed') DEFAULT 'active'");
        }
        const [subLastSent] = await dbConnection.query("SHOW COLUMNS FROM subscribers LIKE 'last_sent_at'");
        if (subLastSent.length === 0) {
            await dbConnection.query("ALTER TABLE subscribers ADD COLUMN last_sent_at TIMESTAMP NULL");
        }

        // Webhooks table
        const createWebhooksTable = `
            CREATE TABLE IF NOT EXISTS webhooks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                site_identifier VARCHAR(255) NOT NULL,
                target_url VARCHAR(1000) NOT NULL,
                event_types VARCHAR(255) NOT NULL,
                secret VARCHAR(255) NOT NULL,
                status ENUM('active','paused') DEFAULT 'active',
                retry_policy VARCHAR(50) DEFAULT 'exponential',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createWebhooksTable);
        console.log('Webhooks table checked/created');

        // Consents table
        const createConsentsTable = `
            CREATE TABLE IF NOT EXISTS consents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                subscriber_id INT NOT NULL,
                purpose VARCHAR(100) NOT NULL,
                status ENUM('granted','denied') NOT NULL,
                source VARCHAR(100),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subscriber_id) REFERENCES subscribers(id)
            );
        `;
        await dbConnection.query(createConsentsTable);
        console.log('Consents table checked/created');

        // API keys table
        const createApiKeysTable = `
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                \`key\` VARCHAR(64) UNIQUE NOT NULL,
                site_identifier VARCHAR(255) NOT NULL,
                status ENUM('active','revoked') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createApiKeysTable);
        console.log('Api_keys table checked/created');

        // Usage metering table
        const createUsageDailyTable = `
            CREATE TABLE IF NOT EXISTS usage_daily (
                id INT AUTO_INCREMENT PRIMARY KEY,
                site_identifier VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                sends INT DEFAULT 0,
                subscribers INT DEFAULT 0,
                webhook_calls INT DEFAULT 0,
                UNIQUE KEY uniq_usage (site_identifier, date),
                FOREIGN KEY (site_identifier) REFERENCES sites(siteIdentifier)
            );
        `;
        await dbConnection.query(createUsageDailyTable);
        console.log('Usage_daily table checked/created');

        // Add campaign and variant columns to notifications table if missing
        const [notifCampaign] = await dbConnection.query("SHOW COLUMNS FROM notifications LIKE 'campaign_id'");
        if (notifCampaign.length === 0) {
            await dbConnection.query("ALTER TABLE notifications ADD COLUMN campaign_id INT NULL");
        }
        const [notifVariant] = await dbConnection.query("SHOW COLUMNS FROM notifications LIKE 'ab_test_variant'");
        if (notifVariant.length === 0) {
            await dbConnection.query("ALTER TABLE notifications ADD COLUMN ab_test_variant VARCHAR(1) NULL");
        }

        // Seed default administrator if not exists
        const [adminCheck] = await dbConnection.query(
            'SELECT id FROM users WHERE email = ?', ['jqel.padgett@gmail.com']
        );
        if (adminCheck.length === 0) {
            const crypto = require('crypto');
            const adminPasswordHash = crypto.createHash('sha256').update('Computer4').digest('hex');
            await dbConnection.query(
                'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                ['Joel Padgett', 'jqel.padgett@gmail.com', adminPasswordHash, 'administrator']
            );
            console.log('Default administrator user seeded');
        } else {
            console.log('Administrator user already exists');
        }

        // Seed a test site for development
        const [siteCheck] = await dbConnection.query(
            'SELECT id FROM sites WHERE siteIdentifier = ?', ['localhost']
        );
        if (siteCheck.length === 0) {
            await dbConnection.query(
                'INSERT INTO sites (siteCode, domain, siteIdentifier) VALUES (?, ?, ?)',
                ['LOCAL001', 'localhost', 'localhost']
            );
            console.log('Test site "localhost" seeded');
        }

        // Link admin to test site
        const [adminUser] = await dbConnection.query('SELECT id FROM users WHERE email = ?', ['jqel.padgett@gmail.com']);
        if (adminUser.length > 0) {
            const [linkCheck] = await dbConnection.query(
                'SELECT id FROM user_sites WHERE user_id = ? AND site_identifier = ?', 
                [adminUser[0].id, 'localhost']
            );
            if (linkCheck.length === 0) {
                await dbConnection.query(
                    'INSERT INTO user_sites (user_id, site_identifier) VALUES (?, ?)',
                    [adminUser[0].id, 'localhost']
                );
                console.log('Admin linked to localhost site');
            }
        }

        await dbConnection.end();
        console.log('✅ Database setup complete');
    } catch (error) {
        console.error('Error creating database tables:', error);
        process.exit(1);
    }
}

// Export the function
module.exports = {
    createDatabaseTables,
    connectToDatabase,
};

// Execute if run directly
if (require.main === module) {
    createDatabaseTables();
}