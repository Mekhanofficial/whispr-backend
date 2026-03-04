const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const poemRoutes = require('./poemRoutes');
const draftRoutes = require('./draftRoutes');
const socialRoutes = require('./socialRoutes');
const vaultRoutes = require('./vaultRoutes');
const uploadRoutes = require('./uploadRoutes');
const syncRoutes = require('./syncRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/poems', poemRoutes);
router.use('/drafts', draftRoutes);
router.use('/social', socialRoutes);
router.use('/vault', vaultRoutes);
router.use('/uploads', uploadRoutes);
router.use('/sync', syncRoutes);

module.exports = router;
