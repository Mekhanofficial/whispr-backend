const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    poemId: { type: String, required: true, index: true },
    poemSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

bookmarkSchema.index({ userId: 1, poemId: 1 }, { unique: true });

module.exports = mongoose.models.Bookmark || mongoose.model('Bookmark', bookmarkSchema);
