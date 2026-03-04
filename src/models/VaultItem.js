const mongoose = require('mongoose');

const vaultItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isDecoy: { type: Boolean, default: false, index: true },
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: 'file' },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
    uri: { type: String, default: '' },
    thumbnailUri: { type: String, default: '' },
    source: { type: String, default: 'import' },
    durationMs: { type: Number, default: 0 },
    categoryHint: { type: String, default: '' },
    createdAtIso: { type: String, default: '' },
    updatedAtIso: { type: String, default: '' },
  },
  { timestamps: true }
);

vaultItemSchema.index({ userId: 1, isDecoy: 1, updatedAt: -1 });
vaultItemSchema.index({ userId: 1, isDecoy: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.models.VaultItem || mongoose.model('VaultItem', vaultItemSchema);
