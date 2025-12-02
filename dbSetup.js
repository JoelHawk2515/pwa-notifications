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
                domain VARCHAR(255) NOT NULL
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
                role VARCHAR(255) NOT NULL DEFAULT 'site-access'
            );
        `;
        await dbConnection.query(createUsersTableQuery);
        console.log('Users table checked/created');

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
                message TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await dbConnection.query(createNotificationsTableQuery);
        console.log('Notifications table checked/created');

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

        await dbConnection.end();
    } catch (error) {
        console.error('Error creating database tables:', error);
    }
}

// Export the function
module.exports = {
    createDatabaseTables,
    connectToDatabase,
};