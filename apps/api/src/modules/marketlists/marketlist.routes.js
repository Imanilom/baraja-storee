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
router.get('/aggregate', marketlistController.getAggregate);
router.get('/:id', marketlistController.getById);

// Create & Edit Marketlist
router.post('/', authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.LEADER, ROLES.STAFF), validate(createMarketlistSchema), marketlistController.create);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.LEADER, ROLES.STAFF), validate(updateMarketlistSchema), marketlistController.update);

// Workflow Actions (support both POST and PUT)
router.post('/:id/submit', authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.LEADER, ROLES.STAFF), marketlistController.submit);
router.put('/:id/submit', authorize(ROLES.ADMIN, ROLES.PURCHASING, ROLES.LEADER, ROLES.STAFF), marketlistController.submit);
router.post('/:id/approve', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), validate(approveMarketlistSchema), marketlistController.approve);
router.put('/:id/approve', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), validate(approveMarketlistSchema), marketlistController.approve);
router.post('/:id/reject', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), validate(rejectMarketlistSchema), marketlistController.reject);
router.put('/:id/reject', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), validate(rejectMarketlistSchema), marketlistController.reject);
router.post('/:id/revision', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), validate(revisionMarketlistSchema), marketlistController.requestRevision);
router.put('/:id/revision', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), validate(revisionMarketlistSchema), marketlistController.requestRevision);
router.post('/:id/approve-items', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), marketlistController.approveItems);
router.put('/:id/approve-items', authorize(ROLES.ADMIN, ROLES.LEADER, ROLES.MANAGEMENT), marketlistController.approveItems);

// Notes per Marketlist
router.get('/:id/notes', noteController.get);
router.put('/:id/notes', validate(marketlistNoteSchema), noteController.update);

module.exports = router;

