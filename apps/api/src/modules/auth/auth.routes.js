const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { loginSchema } = require('@purchasing/validation');

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', authenticate, authController.getProfile);
router.patch('/profile', authenticate, authController.updateProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/change-password', authenticate, authController.changePassword);
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;

