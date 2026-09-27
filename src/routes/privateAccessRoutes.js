const express = require('express');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/privateAccessController');

const router = express.Router();
router.post('/webhook', controller.paystackWebhook);
router.use(requireAuth);
router.get('/status', controller.getPrivateStatus);
router.get('/plans', controller.getPlans);
router.post('/checkout', controller.initializeCheckout);
router.post('/verify', controller.verifyPaymentForUser);

module.exports = router;
