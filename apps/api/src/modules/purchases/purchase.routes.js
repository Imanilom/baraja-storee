const express = require('express');
const router = express.Router();
const purchaseController = require('./purchase.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// Daftar transaksi belanja
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER),
  purchaseController.list
);

// Daftar hutang aktif (unpaid / partial / overdue)
router.get(
  '/debts',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  purchaseController.listDebts
);

// Buat transaksi baru
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING),
  purchaseController.create
);

// Detail transaksi
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER),
  purchaseController.getById
);

// Riwayat pembayaran hutang untuk suatu transaksi
router.get(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  purchaseController.getPayments
);

// Catat pembayaran hutang
router.post(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING),
  purchaseController.recordPayment
);

module.exports = router;
