const express = require('express');
const { requireAuth } = require('../middleware/auth');
const syncController = require('../controllers/syncController');

const router = express.Router();

router.get('/bootstrap', requireAuth, syncController.bootstrap);

module.exports = router;
