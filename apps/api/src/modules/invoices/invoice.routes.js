const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { generateInvoiceSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// List & view invoices
router.get('/', invoiceController.list);
router.get('/:id', invoiceController.getById);
router.get('/:id/pdf', invoiceController.downloadPdf);
router.post('/:id/verify', authorize(ROLES.ACCOUNTING), invoiceController.verify);

// Mounted under /api/v1/marketlists/:marketlistId/invoices
const marketlistInvoiceRouter = express.Router({ mergeParams: true });
marketlistInvoiceRouter.use(authenticate);

router.post(
  '/generate',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING),
  validate(generateInvoiceSchema),
  invoiceController.generate
);

marketlistInvoiceRouter.post(
  '/generate',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING),
  validate(generateInvoiceSchema),
  invoiceController.generate
);

module.exports = {
  invoiceRouter: router,
  marketlistInvoiceRouter
};
