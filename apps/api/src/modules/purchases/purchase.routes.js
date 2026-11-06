const express = require('express');
const router = express.Router();
const purchaseController = require('./purchase.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER),
  purchaseController.list
);

router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING),
  purchaseController.create
);

router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER),
  purchaseController.getById
);

module.exports = router;
