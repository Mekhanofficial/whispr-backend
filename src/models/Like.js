const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, poemKey: { type: String, required: true } },
  { timestamps: true }
);
likeSchema.index({ userId: 1, poemKey: 1 }, { unique: true });
likeSchema.index({ poemKey: 1 });

module.exports = mongoose.models.Like || mongoose.model('Like', likeSchema);
