const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    threadId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: String, required: true, index: true },
    body: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

messageSchema.index({ threadId: 1, createdAt: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
