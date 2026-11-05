const express = require('express');
const router = express.Router();
const kpiController = require('./kpi.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

router.get('/summary', authorize(ROLES.ADMIN, ROLES.MANAGEMENT), kpiController.getSummary);
router.post('/evaluate/:marketlistId', authorize(ROLES.ADMIN), kpiController.calculateForMarketlist);

module.exports = router;
