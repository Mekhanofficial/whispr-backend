const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');

const rootUploadsDir = path.isAbsolute(env.uploadDir)
  ? env.uploadDir
  : path.resolve(__dirname, '..', '..', env.uploadDir);

function isPrivateFolder(value) {
  const folder = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+/, '');
  return /^(vault|private)(?:[_-]|$)/i.test(folder);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(rootUploadsDir);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = req.body?.folder || 'misc';
    if (isPrivateFolder(folder)) {
      cb(new Error('Private vault files cannot use public uploads.'));
      return;
    }
    const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(rootUploadsDir, safeFolder);
    ensureDir(targetDir);
    cb(null, targetDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeBytes,
  },
});

const poemAudioUpload = multer({
  storage,
  limits: { fileSize: Math.min(env.maxFileSizeBytes, 25 * 1024 * 1024) },
  fileFilter(_req, file, cb) {
    if (String(file.mimetype || '').toLowerCase().startsWith('audio/')) return cb(null, true);
    return cb(new Error('Only audio files are supported for voice readings.'));
  },
});

module.exports = {
  uploadSingle: upload.single('file'),
  uploadMany: upload.array('files', 12),
  uploadPoemAudio: poemAudioUpload.single('file'),
  rootUploadsDir,
  isPrivateFolder,
};
