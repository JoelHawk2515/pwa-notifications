const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadController');
const { requireAuth, requireAdmin } = require('../middleware/securityMiddleware');

router.post('/uploads/image', requireAuth, requireAdmin, uploadImage);

module.exports = router;
