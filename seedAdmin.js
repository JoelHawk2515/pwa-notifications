const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { dbConfig } = require('./config/config');

(async () => {
  const username = 'Joel Padgett';
  const passwordPlain = 'Computer4';
  const email = 'admin@example.com';
  const role = 'administrator';

  const passwordHash = crypto.createHash('sha256').update(passwordPlain).digest('hex');

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Check if an administrator exists
    const [admins] = await connection.query('SELECT id FROM users WHERE role = ? LIMIT 1', [role]);

    if (admins.length > 0) {
      const adminId = admins[0].id;
      await connection.query(
        'UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE id = ?',
        [username, email, passwordHash, role, adminId]
      );
      console.log(`✅ Updated existing admin (id=${adminId}) with username="${username}"`);
    } else {
      await connection.query(
        'INSERT INTO users (first_name, last_name, username, password, email, role) VALUES (?, ?, ?, ?, ?, ?)',
        [null, null, username, passwordHash, email, role]
      );
      console.log(`✅ Created new admin user with username="${username}"`);
    }

    // Ensure admin has at least one site mapping (optional)
    const [sites] = await connection.query('SELECT siteIdentifier FROM sites LIMIT 1');
    if (sites.length > 0) {
      const siteIdentifier = sites[0].siteIdentifier;
      const [[adminRow]] = await connection.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
      if (adminRow) {
        // Upsert user_sites
        await connection.query(
          'INSERT IGNORE INTO user_sites (user_id, site_identifier) VALUES (?, ?)',
          [adminRow.id, siteIdentifier]
        );
        console.log(`🔗 Ensured admin linked to site "${siteIdentifier}"`);
      }
    }

    console.log('Done. You can now login with:');
    console.log('  Username: Joel Padgett');
    console.log('  Password: Computer4');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
})();
