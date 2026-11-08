const express = require('express');
const router = express.Router();
const locationController = require('./location.controller');
const authenticate = require('../../middleware/auth');

router.use(authenticate);
router.get('/', locationController.list);

module.exports = router;
