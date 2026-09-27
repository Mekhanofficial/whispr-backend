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

function validateJwtSecret(value, nodeEnv = 'development') {
  const secret = String(value || '').trim();
  if (!secret || /^(change-me|secret|password|replace-)/i.test(secret)) {
    throw new Error('JWT_SECRET is missing or insecure. Set a unique secret in backend/.env.local or the deployment environment.');
  }
  if (nodeEnv === 'production' && secret.length < 32) {
    throw new Error('Production JWT_SECRET must contain at least 32 characters.');
  }
  return secret;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const adminEnvPresent = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_JWT_SECRET'].some((key) => process.env[key]);
if (adminEnvPresent) {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_JWT_SECRET || (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD)) {
    throw new Error('Admin configuration is incomplete. Set ADMIN_EMAIL, ADMIN_JWT_SECRET, and ADMIN_PASSWORD_HASH or ADMIN_PASSWORD.');
  }
}

if (nodeEnv !== 'production') {
  // Development-only diagnostics. Never print credential or secret values.
  // eslint-disable-next-line no-console
  console.log(`[admin-auth] ADMIN_EMAIL loaded: ${process.env.ADMIN_EMAIL ? 'yes' : 'no'}`);
  // eslint-disable-next-line no-console
  console.log(`[admin-auth] ADMIN_PASSWORD loaded: ${process.env.ADMIN_PASSWORD ? 'yes' : 'no'}`);
  // eslint-disable-next-line no-console
  console.log(`[admin-auth] ADMIN_PASSWORD_HASH loaded: ${process.env.ADMIN_PASSWORD_HASH ? 'yes' : 'no'}`);
  // eslint-disable-next-line no-console
  console.log(`[admin-auth] ADMIN_JWT_SECRET loaded: ${process.env.ADMIN_JWT_SECRET ? 'yes' : 'no'}`);
}

module.exports = {
  port: toInt(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || '',
  jwtSecret: validateJwtSecret(process.env.JWT_SECRET, nodeEnv),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeBytes: toInt(process.env.MAX_FILE_SIZE_MB, 25) * 1024 * 1024,
  paystackSecretKey: String(process.env.PAYSTACK_SECRET_KEY || '').trim(),
  paystackWebhookSecret: String(process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '').trim(),
  paystackCallbackUrl: String(process.env.PAYSTACK_CALLBACK_URL || '').trim(),
  adminEmails: String(process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
  adminEmail: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: String(process.env.ADMIN_PASSWORD || ''),
  adminPasswordHash: String(process.env.ADMIN_PASSWORD_HASH || ''),
  adminJwtSecret: process.env.ADMIN_JWT_SECRET ? validateJwtSecret(process.env.ADMIN_JWT_SECRET, nodeEnv) : '',
  adminSessionExpiresIn: process.env.ADMIN_SESSION_EXPIRES_IN || '8h',
};

module.exports.validateJwtSecret = validateJwtSecret;
