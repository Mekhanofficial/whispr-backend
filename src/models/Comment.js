const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    poemId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    body: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

commentSchema.index({ poemId: 1, createdAt: 1 });

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
