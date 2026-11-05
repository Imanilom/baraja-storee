const express = require('express');
const router = express.Router();
const supplierController = require('./supplier.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { supplierSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

router.get('/', supplierController.list);
router.get('/:id', supplierController.getById);
router.post('/', authorize(ROLES.ADMIN, ROLES.PURCHASING), validate(supplierSchema), supplierController.create);
router.patch('/:id', authorize(ROLES.ADMIN), supplierController.update);

module.exports = router;

