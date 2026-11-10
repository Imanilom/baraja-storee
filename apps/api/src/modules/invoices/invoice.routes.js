const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { generateInvoiceSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

// PDF download route allows direct viewing/downloading in browser (window.open or direct URL)
router.get('/:id/pdf', invoiceController.downloadPdf);

router.use(authenticate);

// List & view invoices
router.get('/', invoiceController.list);
router.get('/:id', invoiceController.getById);
router.post('/:id/verify', authorize(ROLES.ACCOUNTING), invoiceController.verify);

// Mounted under /api/v1/marketlists/:marketlistId/invoices
const marketlistInvoiceRouter = express.Router({ mergeParams: true });
marketlistInvoiceRouter.use(authenticate);

router.post(
  '/generate',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING, ROLES.PURCHASING, ROLES.MANAGEMENT, ROLES.LEADER),
  validate(generateInvoiceSchema),
  invoiceController.generate
);

marketlistInvoiceRouter.post(
  '/generate',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING, ROLES.PURCHASING, ROLES.MANAGEMENT, ROLES.LEADER),
  validate(generateInvoiceSchema),
  invoiceController.generate
);

module.exports = {
  invoiceRouter: router,
  marketlistInvoiceRouter
};

