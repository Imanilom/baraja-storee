const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const inventoryController = require('./inventory.controller');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);
router.get(
  '/daily',
  authorize(
    ROLES.ADMIN,
    ROLES.MANAGEMENT,
    ROLES.PURCHASING,
    ROLES.ACCOUNTING,
    ROLES.LEADER,
    ROLES.RECEIVER,
    ROLES.STAFF
  ),
  inventoryController.getDailyReconciliation
);

module.exports = router;
