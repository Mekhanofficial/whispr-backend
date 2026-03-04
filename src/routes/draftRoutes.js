const express = require('express');
const { requireAuth } = require('../middleware/auth');
const draftController = require('../controllers/draftController');

const router = express.Router();

router.use(requireAuth);
router.get('/', draftController.listDrafts);
router.post('/', draftController.createDraft);
router.patch('/:id', draftController.updateDraft);
router.delete('/:id', draftController.deleteDraft);

module.exports = router;
