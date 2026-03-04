const mongoose = require('mongoose');

const poemSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    author: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    previewContent: { type: String, default: '' },
    fullContent: { type: String, required: true },
    category: { type: String, default: 'All', index: true },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPublic: { type: Boolean, default: true, index: true },
    source: { type: String, enum: ['seed', 'user'], default: 'user' },
  },
  { timestamps: true }
);

poemSchema.index({ createdAt: -1, isPublic: 1 });

module.exports = mongoose.models.Poem || mongoose.model('Poem', poemSchema);
