const express = require('express');
const router = express.Router();
const { registerWebhook, listWebhooks } = require('../controllers/webhookController');
const { requireAuth, requireAdmin } = require('../middleware/securityMiddleware');

router.post('/webhooks', requireAuth, requireAdmin, registerWebhook);
router.get('/webhooks', requireAuth, listWebhooks);

module.exports = router;
