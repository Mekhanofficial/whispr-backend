const express = require('express');
const { requireAuth } = require('../middleware/auth');
const poemController = require('../controllers/poemController');
const engagementController = require('../controllers/engagementController');

const router = express.Router();

router.get('/', poemController.listPublicPoems);
router.get('/public', poemController.listPublicPoems);
router.get('/daily-quote', poemController.getDailyQuote);
router.post('/engagement/batch', requireAuth, engagementController.batchEngagement);
router.post('/:poemKey/like', requireAuth, engagementController.setLike);
router.delete('/:poemKey/like', requireAuth, engagementController.setLike);
router.get('/mine', requireAuth, poemController.listMyPoems);
router.get('/:id', poemController.getPoem);
router.post('/', requireAuth, poemController.createPoem);
router.patch('/:id', requireAuth, poemController.updatePoem);
router.delete('/:id', requireAuth, poemController.deletePoem);
router.post('/:id/like-toggle', requireAuth, poemController.toggleLike);
router.put('/:id/like', requireAuth, poemController.setLike);
router.delete('/:id/like', requireAuth, poemController.setLike);

module.exports = router;
