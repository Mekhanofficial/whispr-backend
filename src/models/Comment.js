const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    poemId: { type: String, required: true, index: true },
    poemKey: { type: String, index: true },
    authorId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    body: { type: String, required: true, trim: true },
    moderationStatus: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
    clientMutationId: { type: String, default: undefined },
  },
  { timestamps: true }
);

commentSchema.index({ poemId: 1, createdAt: 1 });
commentSchema.index({ poemKey: 1, createdAt: 1 });
commentSchema.index({ userId: 1, clientMutationId: 1 }, { unique: true, partialFilterExpression: { clientMutationId: { $type: 'string' } } });

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
