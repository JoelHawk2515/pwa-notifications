const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth, requireAdmin } = require('../middleware/securityMiddleware');

// All analytics routes require authentication
router.use(requireAuth);

// Get comprehensive analytics
router.get('/analytics', analyticsController.getAnalytics);

// Get funnel analysis
router.get('/analytics/funnel', analyticsController.getFunnelAnalysis);

// Get cohort analysis
router.get('/analytics/cohorts', analyticsController.getCohortAnalysis);

// Export analytics to CSV (admin only)
router.get('/analytics/export', requireAdmin, analyticsController.exportAnalytics);

// Get real-time metrics
router.get('/analytics/realtime', analyticsController.getRealTimeMetrics);

module.exports = router;
