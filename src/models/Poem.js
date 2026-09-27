const mongoose = require('mongoose');

const poemSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    author: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    previewContent: { type: String, default: '' },
    fullContent: { type: String, required: true },
    category: { type: String, default: 'All', index: true },
    mood: { type: String, default: '', index: true },
    visibility: { type: String, enum: ['public', 'only_me'], default: 'public', index: true },
    promptId: { type: mongoose.Schema.Types.ObjectId, ref: 'WritingPrompt', default: null, index: true },
    audio: {
      assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadAsset', default: null },
      url: { type: String, default: '' },
      durationMs: { type: Number, default: 0 },
    },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPublic: { type: Boolean, default: true, index: true },
    moderationStatus: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
    source: { type: String, enum: ['seed', 'user'], default: 'user' },
    clientMutationId: { type: String, default: undefined },
  },
  { timestamps: true }
);

poemSchema.index({ createdAt: -1, isPublic: 1 });
poemSchema.index({ visibility: 1, createdAt: -1 });
poemSchema.index({ authorId: 1, clientMutationId: 1 }, { unique: true, partialFilterExpression: { clientMutationId: { $type: 'string' } } });

module.exports = mongoose.models.Poem || mongoose.model('Poem', poemSchema);
