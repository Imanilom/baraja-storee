const express = require('express');
const router = express.Router();
const priceController = require('./prices.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

router.get('/overview', authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT), priceController.getLatestOverview);
router.get('/products/:id', authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.ACCOUNTING, ROLES.MANAGEMENT), priceController.getProductPrices);

module.exports = router;
