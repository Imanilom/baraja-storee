const express = require('express');
const router = express.Router();
const marketlistController = require('./marketlist.controller');
const noteController = require('../notes/marketlist-note.controller');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const {
  createMarketlistSchema,
  updateMarketlistSchema,
  approveMarketlistSchema,
  rejectMarketlistSchema,
  revisionMarketlistSchema,
  marketlistNoteSchema
} = require('@purchasing/validation');
const { ROLES } = require('@purchasing/constants');

router.use(authenticate);

// List & Read Marketlist
router.get('/', marketlistController.list);
router.get('/:id', marketlistController.getById);

// Create & Edit Marketlist
router.post('/', authorize(ROLES.ADMIN, ROLES.PURCHASING), validate(createMarketlistSchema), marketlistController.create);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.PURCHASING), validate(updateMarketlistSchema), marketlistController.update);

// Workflow Actions (support both POST and PUT)
router.post('/:id/submit', authorize(ROLES.ADMIN, ROLES.PURCHASING), marketlistController.submit);
router.put('/:id/submit', authorize(ROLES.ADMIN, ROLES.PURCHASING), marketlistController.submit);
router.post('/:id/approve', authorize(ROLES.ADMIN), validate(approveMarketlistSchema), marketlistController.approve);
router.put('/:id/approve', authorize(ROLES.ADMIN), validate(approveMarketlistSchema), marketlistController.approve);
router.post('/:id/reject', authorize(ROLES.ADMIN), validate(rejectMarketlistSchema), marketlistController.reject);
router.put('/:id/reject', authorize(ROLES.ADMIN), validate(rejectMarketlistSchema), marketlistController.reject);
router.post('/:id/revision', authorize(ROLES.ADMIN), validate(revisionMarketlistSchema), marketlistController.requestRevision);
router.put('/:id/revision', authorize(ROLES.ADMIN), validate(revisionMarketlistSchema), marketlistController.requestRevision);

// Notes per Marketlist
router.get('/:id/notes', noteController.get);
router.put('/:id/notes', validate(marketlistNoteSchema), noteController.update);

module.exports = router;

