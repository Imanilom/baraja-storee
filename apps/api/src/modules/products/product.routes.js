const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { productSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// Category & Unit endpoints
router.get('/categories', productController.listCategories);
router.post('/categories', authorize(ROLES.ADMIN), productController.createCategory);

router.get('/units', productController.listUnits);
router.post('/units', authorize(ROLES.ADMIN), productController.createUnit);

// Product endpoints
router.get('/', productController.list);
router.get('/:id', productController.getById);
router.post('/', authorize(ROLES.ADMIN, ROLES.PURCHASING), validate(productSchema), productController.create);
router.patch('/:id', authorize(ROLES.ADMIN), productController.update);

module.exports = router;

