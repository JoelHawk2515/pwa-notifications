// Route to display the form for creating a push notification
exports.createPushForm = (req, res) => {
    res.send(`
        <form action="/create-push" method="post">
            <label for="siteCode">Site Code:</label>
            <input type="text" id="siteCode" name="siteCode" required />
            <button type="submit">Submit</button>
        </form>`
    );
};

exports.createPush = async (req, res) => {
    const siteCode = req.body.siteCode || '';
    const domain = `${siteCode}.solutiosoftware.com`;
    const siteIdentifier = uuidv4().substring(0, 10); // Generate a 10-digit key

    const connection = await mysql.createConnection(dbConfig);

    try {
        const checkQuery = 'SELECT * FROM sites WHERE siteCode = ?';
        const [results] = await connection.query(checkQuery, [siteCode]);

        if (results.length > 0) {
            return res.send('Site code already exists in the database');
        }

        const insertQuery = 'INSERT INTO sites (siteCode, domain, siteIdentifier) VALUES (?, ?, ?)';
        await connection.query(insertQuery, [siteCode, domain, siteIdentifier]);

        res.send('Site code added to the database');
    } catch (error) {
        console.error('Error inserting into the database:', error);
        res.status(500).send('Error inserting into the database');
    } finally {
        connection.end();
    }
};