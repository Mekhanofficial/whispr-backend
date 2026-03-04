const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { uploadSingle, uploadMany } = require('../middleware/upload');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

router.use(requireAuth);
router.post('/single', uploadSingle, uploadController.uploadSingle);
router.post('/multiple', uploadMany, uploadController.uploadMultiple);
router.post('/vault', uploadMany, uploadController.uploadMultiple);

module.exports = router;
