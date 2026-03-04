const express = require('express');
const { requireAuth } = require('../middleware/auth');
const poemController = require('../controllers/poemController');

const router = express.Router();

router.get('/', poemController.listPublicPoems);
router.get('/public', poemController.listPublicPoems);
router.get('/daily-quote', poemController.getDailyQuote);
router.get('/mine', requireAuth, poemController.listMyPoems);
router.get('/:id', poemController.getPoem);
router.post('/', requireAuth, poemController.createPoem);
router.patch('/:id', requireAuth, poemController.updatePoem);
router.delete('/:id', requireAuth, poemController.deletePoem);
router.post('/:id/like-toggle', requireAuth, poemController.toggleLike);

module.exports = router;
