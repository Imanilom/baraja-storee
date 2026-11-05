const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const authenticate = require('../../middleware/auth');

router.use(authenticate);
router.get('/', dashboardController.getMetrics);

module.exports = router;
