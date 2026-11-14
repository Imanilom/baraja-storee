const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { generateInvoiceSchema, updateInvoiceItemsSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// PDF download routes support direct viewing/downloading in browser (window.open or direct URL).
router.get('/weekly-pdf', invoiceController.downloadWeeklyPdf);
router.get('/:id/pdf', invoiceController.downloadPdf);

// List & view invoices
router.get('/', invoiceController.list);
router.get('/:id', invoiceController.getById);
router.post(
  '/generate-all',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING, ROLES.PURCHASING, ROLES.MANAGEMENT),
  invoiceController.regenerateAll
);
router.post('/:id/verify', authorize(ROLES.ACCOUNTING), invoiceController.verify);
router.patch(
  '/:id/items',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING, ROLES.PURCHASING, ROLES.MANAGEMENT),
  validate(updateInvoiceItemsSchema),
  invoiceController.updateItems
);
router.post(
  '/:id/refresh-prices',
  authorize(ROLES.ADMIN, ROLES.ACCOUNTING, ROLES.PURCHASING, ROLES.MANAGEMENT),
  invoiceController.refreshPrices
);

// Mounted under /api/v1/marketlists/:marketlistId/invoices
const marketlistInvoiceRouter = express.Router({ mergeParams: true });
marketlistInvoiceRouter.use(authenticate);

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
