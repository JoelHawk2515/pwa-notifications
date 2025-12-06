const express = require('express');
const router = express.Router();
const { listSubscribers, updateSubscriberStatus, deleteSubscriber } = require('../controllers/subscriberController');
const { requireAuth, requireAdmin } = require('../middleware/securityMiddleware');

router.use(requireAuth);

router.get('/subscribers', listSubscribers);
router.post('/subscribers/:id/status', requireAdmin, updateSubscriberStatus);
router.delete('/subscribers/:id', requireAdmin, deleteSubscriber);

module.exports = router;
