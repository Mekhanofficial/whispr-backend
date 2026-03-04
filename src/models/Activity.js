const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, default: '' },
    poemId: { type: String, default: '' },
    draftId: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
