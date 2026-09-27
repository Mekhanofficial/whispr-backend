const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const controller = require('../controllers/privateAccessAdminController');

const router = express.Router();
router.use(requireAdminAuth);
router.get('/pricing', controller.getPricing);
router.get('/summary', controller.summary);
router.patch('/pricing', controller.updatePricing);
router.get('/users', controller.listUsers);
router.patch('/users/:userId/eligibility', controller.setEligibility);
router.post('/users/:userId/activate', controller.activateManually);
router.post('/users/:userId/cancel', controller.cancel);
router.get('/users/:userId/payments', controller.payments);
router.get('/payments', controller.payments);

module.exports = router;
