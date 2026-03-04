const mongoose = require('mongoose');

const vaultCloneSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cloneId: { type: String, required: true },
    alias: { type: String, default: '' },
    name: { type: String, default: '' },
    package: { type: String, required: true },
    icon: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastLaunchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

vaultCloneSchema.index({ userId: 1, cloneId: 1 }, { unique: true });

module.exports = mongoose.models.VaultClone || mongoose.model('VaultClone', vaultCloneSchema);
