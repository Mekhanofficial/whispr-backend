const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePrivateAccess } = require('../middleware/privateAccess');
const vaultController = require('../controllers/vaultController');

const router = express.Router();

router.use(requireAuth);

router.get('/items', vaultController.listVaultItems);
router.post('/items', requirePrivateAccess, vaultController.upsertVaultItem);
router.delete('/items/:itemId', vaultController.deleteVaultItem);
router.get('/summary', vaultController.getVaultSummary);
router.get('/inventory', vaultController.getVaultInventory);
router.delete('/all', vaultController.deleteAllVaultData);

router.get('/clones', vaultController.listVaultClones);
router.post('/clones', requirePrivateAccess, vaultController.createVaultClone);
router.delete('/clones/:cloneId', vaultController.removeVaultClone);

router.patch('/settings', vaultController.updateVaultSettings);

module.exports = router;
