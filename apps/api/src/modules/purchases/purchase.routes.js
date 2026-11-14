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
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER, ROLES.LEADER, ROLES.STAFF),
  purchaseController.list
);

// Daftar hutang aktif (unpaid / partial / overdue)
router.get(
  '/debts/report-pdf',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  purchaseController.downloadDebtReportPdf
);

router.get(
  '/debts',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  purchaseController.listDebts
);

router.get(
  '/daily-summary',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER, ROLES.LEADER, ROLES.STAFF),
  purchaseController.dailySummary
);

// Buat transaksi baru
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.MANAGEMENT, ROLES.LEADER, ROLES.STAFF),
  purchaseController.create
);

// Detail transaksi
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER, ROLES.LEADER, ROLES.STAFF),
  purchaseController.getById
);

// Edit transaksi belanja (ubah status hutang/tempo, supplier, invoice, catatan)
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.MANAGEMENT, ROLES.LEADER, ROLES.STAFF),
  purchaseController.update
);

// Hapus transaksi belanja
router.delete(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.MANAGEMENT, ROLES.LEADER),
  purchaseController.delete
);

// Riwayat pembayaran hutang untuk suatu transaksi
router.get(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  purchaseController.getPayments
);

// Catat pembayaran hutang
router.post(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.LEADER),
  purchaseController.recordPayment
);

module.exports = router;
