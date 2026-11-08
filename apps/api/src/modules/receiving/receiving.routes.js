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

// Support direct /receiving/receipts/:marketlistId or /receipts/marketlist/:marketlistId
router.get('/receipts/:marketlistId', receivingController.getByMarketlist);
router.post(
  '/receipts/:marketlistId',
  authorize(ROLES.ADMIN, ROLES.RECEIVER, ROLES.LEADER, ROLES.STAFF),
  validate(createGoodsReceiptSchema),
  receivingController.create
);

// Mounted under /api/v1/marketlists/:marketlistId/receipts in app.js
const marketlistReceiptRouter = express.Router({ mergeParams: true });
marketlistReceiptRouter.use(authenticate);

marketlistReceiptRouter.get('/', receivingController.getByMarketlist);
marketlistReceiptRouter.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEIVER, ROLES.LEADER, ROLES.STAFF),
  validate(createGoodsReceiptSchema),
  receivingController.create
);

module.exports = {
  receivingRouter: router,
  marketlistReceiptRouter
};

