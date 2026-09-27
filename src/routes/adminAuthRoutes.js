const express = require('express');
const controller = require('../controllers/adminAuthController');
const { requireAdminAuth } = require('../middleware/adminAuth');
const router = express.Router();
router.get('/me', requireAdminAuth, controller.me);
router.post('/logout', requireAdminAuth, controller.logout);
module.exports = router;
