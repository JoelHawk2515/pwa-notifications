const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/securityMiddleware');
const { getTemplates, createTemplate, updateTemplate, deleteTemplate, useTemplate } = require('../controllers/templateController');

// Get all templates
router.get('/templates', requireAuth, getTemplates);

// Create a new template
router.post('/templates', requireAdmin, createTemplate);

// Update a template
router.put('/templates/:id', requireAdmin, updateTemplate);

// Delete a template
router.delete('/templates/:id', requireAdmin, deleteTemplate);

// Use a template to send notification
router.post('/templates/:id/use', requireAdmin, useTemplate);

module.exports = router;
