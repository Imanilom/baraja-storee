const express = require('express');
const router = express.Router();
const cashFlowController = require('./cash-flow.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// Ringkasan saldo & metrik arus kas
router.get(
  '/summary',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  cashFlowController.getSummary
);

// Riwayat mutasi arus kas
router.get(
  '/mutations',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  cashFlowController.getMutations
);

// Catat uang masuk
router.post(
  '/in',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  cashFlowController.recordIn
);

// Catat tarik tunai (Bank -> Kas)
router.post(
  '/withdraw',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  cashFlowController.recordWithdrawal
);

// Catat kas keluar manual
router.post(
  '/out',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  cashFlowController.recordOut
);

// Hapus transaksi manual
router.delete(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  cashFlowController.delete
);

module.exports = router;

