const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(backendRoot, '..');

// Load most-specific files first. dotenv does not override existing vars by default.
[
  path.join(backendRoot, '.env.local'),
  path.join(backendRoot, '.env'),
  path.join(projectRoot, '.env.local'),
  path.join(projectRoot, '.env'),
].forEach((envPath) => {
  dotenv.config({ path: envPath });
});

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  port: toInt(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeBytes: toInt(process.env.MAX_FILE_SIZE_MB, 25) * 1024 * 1024,
};
