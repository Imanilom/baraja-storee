const express = require('express');
const router = express.Router();
const receivingController = require('./receiving.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { createGoodsReceiptSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// Receipt endpoints
router.get('/:id', receivingController.getById);

// Mounted under /api/v1/marketlists/:marketlistId/receipts in app.js
const marketlistReceiptRouter = express.Router({ mergeParams: true });
marketlistReceiptRouter.use(authenticate);

marketlistReceiptRouter.get('/', receivingController.getByMarketlist);
marketlistReceiptRouter.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEIVER),
  validate(createGoodsReceiptSchema),
  receivingController.create
);

module.exports = {
  receivingRouter: router,
  marketlistReceiptRouter
};
