const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 500 },
  cover: { type: String, default: '' },
  visibility: { type: String, enum: ['private', 'public'], default: 'private', index: true },
  poemIds: [{ type: String }],
}, { timestamps: true });

collectionSchema.index({ ownerId: 1, name: 1 }, { unique: true });
module.exports = mongoose.models.Collection || mongoose.model('Collection', collectionSchema);
