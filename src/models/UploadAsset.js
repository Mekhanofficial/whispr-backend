const mongoose = require('mongoose');

const uploadAssetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    fieldName: { type: String, default: 'file' },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    folder: { type: String, default: 'misc' },
    relativePath: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.UploadAsset || mongoose.model('UploadAsset', uploadAssetSchema);
