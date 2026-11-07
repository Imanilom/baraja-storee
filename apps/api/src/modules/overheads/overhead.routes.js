const express = require('express');
const router = express.Router();
const overheadController = require('./overhead.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// 1. Ringkasan biaya & statistik overhead
router.get(
  '/summary',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  overheadController.getSummary
);

// 2. Daftar hutang / tagihan tempo overhead yang belum lunas
router.get(
  '/debts',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  overheadController.listDebts
);

// 3. Daftar semua pengeluaran overhead (dengan filter & pagination)
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT, ROLES.RECEIVER),
  overheadController.list
);

// 4. Catat pengeluaran overhead baru
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING),
  overheadController.create
);

// 5. Detail pengeluaran overhead
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  overheadController.getById
);

// 6. Update data overhead
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING),
  overheadController.update
);

// 7. Hapus data overhead
router.delete(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING),
  overheadController.delete
);

// 8. Riwayat pembayaran tagihan tempo untuk overhead tertentu
router.get(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT),
  overheadController.getPayments
);

// 9. Catat pembayaran hutang/tempo overhead
router.post(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING),
  overheadController.recordPayment
);

module.exports = router;

