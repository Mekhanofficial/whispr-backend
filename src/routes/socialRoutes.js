const express = require('express');
const { requireAuth } = require('../middleware/auth');
const socialController = require('../controllers/socialController');

const router = express.Router();

router.use(requireAuth);

router.get('/bookmarks', socialController.listBookmarks);
router.post('/bookmarks/toggle', socialController.toggleBookmark);

router.get('/follows', socialController.listFollows);
router.post('/follows/:userId', socialController.followUser);
router.delete('/follows/:userId', socialController.unfollowUser);

router.get('/comments/:poemId', socialController.listComments);
router.post('/comments/:poemId', socialController.addComment);

router.get('/messages/:userId', socialController.getThread);
router.post('/messages/:userId', socialController.sendMessage);

router.get('/favorite-authors', socialController.listFavoriteAuthors);
router.post('/favorite-authors/toggle', socialController.toggleFavoriteAuthor);

router.get('/activity', socialController.listActivity);
router.post('/activity', socialController.addActivity);

module.exports = router;
