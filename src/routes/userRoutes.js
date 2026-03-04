const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/', userController.listUsers);
router.patch('/me', requireAuth, userController.updateMe);
router.get('/:id/followers', userController.listFollowers);
router.get('/:id/following', userController.listFollowing);
router.get('/:id', userController.getUser);

module.exports = router;
