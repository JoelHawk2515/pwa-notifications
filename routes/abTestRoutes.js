const express = require('express');
const router = express.Router();
const abTestController = require('../controllers/abTestController');
const { requireAuth, requireAdmin, validateNotificationPayload } = require('../middleware/securityMiddleware');

// All A/B test routes require authentication
router.use(requireAuth);

// Create a new A/B test (admin only)
router.post('/ab-tests', requireAdmin, validateNotificationPayload, abTestController.createABTest);

// Get all A/B tests for a site
router.get('/ab-tests', abTestController.getABTests);

// Get A/B test results
router.get('/ab-tests/:test_id/results', abTestController.getABTestResults);

// Start an A/B test (admin only)
router.post('/ab-tests/:test_id/start', requireAdmin, abTestController.startABTest);

// Stop an A/B test (admin only)
router.post('/ab-tests/:test_id/stop', requireAdmin, abTestController.stopABTest);

// Track A/B test events (opened, clicked)
router.post('/ab-tests/track', abTestController.trackABTestEvent);

module.exports = router;
