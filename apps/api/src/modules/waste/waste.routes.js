const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const wasteController = require('./waste.controller');
const { ROLES } = require('@purchasing/constants');

const operationalRoles = [
  ROLES.ADMIN,
  ROLES.MANAGEMENT,
  ROLES.PURCHASING,
  ROLES.RECEIVER,
  ROLES.LEADER,
  ROLES.STAFF
];

router.use(authenticate);
router.get('/', authorize(...operationalRoles, ROLES.ACCOUNTING), wasteController.list);
router.post('/', authorize(...operationalRoles), wasteController.create);

module.exports = router;
