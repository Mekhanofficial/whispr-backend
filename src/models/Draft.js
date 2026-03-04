const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Untitled Draft' },
    body: { type: String, default: '' },
    category: { type: String, default: '' },
    lastEdited: { type: String, default: '' },
  },
  { timestamps: true }
);

draftSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.models.Draft || mongoose.model('Draft', draftSchema);
