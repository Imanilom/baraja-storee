const express = require('express');
const router = express.Router();
const profitLossController = require('./profit-loss.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// Available to Admin, Accounting, and Management roles
router.get(
  '/profit-loss',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  profitLossController.getReport
);

module.exports = router;
