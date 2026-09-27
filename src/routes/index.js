const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const poemRoutes = require('./poemRoutes');
const draftRoutes = require('./draftRoutes');
const socialRoutes = require('./socialRoutes');
const vaultRoutes = require('./vaultRoutes');
const uploadRoutes = require('./uploadRoutes');
const syncRoutes = require('./syncRoutes');
const privateAccessRoutes = require('./privateAccessRoutes');
const privateAccessAdminRoutes = require('./privateAccessAdminRoutes');
const adminAuthRoutes = require('./adminAuthRoutes');
const adminRoutes = require('./adminRoutes');
const promptRoutes = require('./promptRoutes');
const collectionRoutes = require('./collectionRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/poems', poemRoutes);
router.use('/drafts', draftRoutes);
router.use('/social', socialRoutes);
router.use('/vault', vaultRoutes);
router.use('/uploads', uploadRoutes);
router.use('/sync', syncRoutes);
router.use('/private-access', privateAccessRoutes);
router.use('/admin/private-access', privateAccessAdminRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', adminRoutes);
router.use('/prompts', promptRoutes);
router.use('/collections', collectionRoutes);

module.exports = router;
