const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');

const rootUploadsDir = path.resolve(process.cwd(), 'backend', env.uploadDir);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(rootUploadsDir);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = req.body?.folder || 'misc';
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

module.exports = {
  uploadSingle: upload.single('file'),
  uploadMany: upload.array('files', 12),
  rootUploadsDir,
};
