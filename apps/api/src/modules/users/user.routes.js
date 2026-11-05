const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { registerUserSchema } = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.MANAGEMENT), userController.list);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.MANAGEMENT), userController.getById);
router.post('/', authorize(ROLES.ADMIN), validate(registerUserSchema), userController.create);
router.patch('/:id', authorize(ROLES.ADMIN), userController.update);

module.exports = router;

