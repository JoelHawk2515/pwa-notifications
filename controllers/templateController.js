const mysql = require('mysql2/promise');
const { connectToDatabase } = require('../dbSetup');

// Get all templates for a site
async function getTemplates(req, res) {
    try {
        const siteIdentifier = req.query.siteIdentifier || req.session.user.site_identifier;
        const connection = await connectToDatabase();
        
        const [templates] = await connection.query(
            `SELECT * FROM notification_templates 
             WHERE site_identifier = ? OR site_identifier IS NULL 
             ORDER BY is_global DESC, created_at DESC`,
            [siteIdentifier]
        );
        
        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Error fetching templates' });
    }
}

// Create a new template
async function createTemplate(req, res) {
    try {
        const { name, title, body, icon, image, url, tags, is_global } = req.body;
        const siteIdentifier = req.body.site_identifier || req.session.user.site_identifier;
        const createdBy = req.session.user.id;

        if (!name || !title || !body) {
            return res.status(400).json({ success: false, message: 'Name, title, and body are required' });
        }

        const connection = await connectToDatabase();
        const [result] = await connection.query(
            `INSERT INTO notification_templates 
             (name, site_identifier, title, body, icon, image, url, tags, is_global, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, siteIdentifier, title, body, icon, image, url, tags, is_global || false, createdBy]
        );

        res.json({ 
            success: true, 
            message: 'Template created successfully',
            template_id: result.insertId 
        });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ success: false, message: 'Error creating template' });
    }
}

// Update a template
async function updateTemplate(req, res) {
    try {
        const { id } = req.params;
        const { name, title, body, icon, image, url, tags } = req.body;

        const connection = await connectToDatabase();
        await connection.query(
            `UPDATE notification_templates 
             SET name = ?, title = ?, body = ?, icon = ?, image = ?, url = ?, tags = ? 
             WHERE id = ?`,
            [name, title, body, icon, image, url, tags, id]
        );

        res.json({ success: true, message: 'Template updated successfully' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ success: false, message: 'Error updating template' });
    }
}

// Delete a template
async function deleteTemplate(req, res) {
    try {
        const { id } = req.params;

        const connection = await connectToDatabase();
        await connection.query('DELETE FROM notification_templates WHERE id = ?', [id]);

        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, message: 'Error deleting template' });
    }
}

// Use a template to send a notification
async function useTemplate(req, res) {
    try {
        const { templateId, variables, scheduledTime, audienceType } = req.body;
        
        const connection = await connectToDatabase();
        const [templates] = await connection.query(
            'SELECT * FROM notification_templates WHERE id = ?',
            [templateId]
        );

        if (templates.length === 0) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        const template = templates[0];
        
        // Replace variables in template
        let title = template.title;
        let body = template.body;
        
        if (variables) {
            Object.keys(variables).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                title = title.replace(regex, variables[key]);
                body = body.replace(regex, variables[key]);
            });
        }

        // Forward to sendNotification with template data
        req.body = {
            siteIdentifier: template.site_identifier,
            title,
            body,
            icon: template.icon,
            image: template.image,
            url: template.url,
            scheduledTime,
            audienceType,
            notificationId: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };

        // Import and call sendNotification
        const { sendNotification } = require('./notificationController');
        return sendNotification(req, res);

    } catch (error) {
        console.error('Error using template:', error);
        res.status(500).json({ success: false, message: 'Error using template' });
    }
}

module.exports = {
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate
};
