const path = require('path');
const UploadAsset = require('../models/UploadAsset');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

function toUploadPayload(req, file) {
  const relativePath = path
    .relative(path.resolve(process.cwd(), 'backend'), file.path)
    .replace(/\\/g, '/');
  const origin = `${req.protocol}://${req.get('host')}`;
  return {
    userId: req.user?._id || null,
    fieldName: file.fieldname,
    originalName: file.originalname,
    filename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    folder: req.body?.folder || 'misc',
    relativePath,
    // Native audio players need a resolvable URL; a relative static path only
    // works in a browser document.
    url: `${origin}/${relativePath}`,
  };
}

const uploadSingle = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const doc = await UploadAsset.create(toUploadPayload(req, req.file));
  res.status(201).json({ success: true, data: doc });
});

const uploadMultiple = asyncHandler(async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) throw new ApiError(400, 'No files uploaded');
  const docs = await UploadAsset.insertMany(files.map((file) => toUploadPayload(req, file)));
  res.status(201).json({ success: true, data: docs });
});

module.exports = {
  uploadSingle,
  uploadMultiple,
};
