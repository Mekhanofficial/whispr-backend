const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signAccessToken } = require('../utils/token');
const { signAdminToken } = require('../utils/adminToken');
const { recordAdminAction } = require('../services/adminAudit');

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function profileFromName(fullName = '') {
  const firstName = fullName.trim().split(/\s+/)[0] || 'writer';
  const handle = `@${firstName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'writer'}`;
  return {
    name: fullName.trim() || 'Writer',
    handle,
    bio: 'Poet & Storyteller',
    location: '',
    avatarUrl: '',
    verified: false,
    since: new Date().getFullYear(),
  };
}

function buildAuthResponse(user) {
  const token = signAccessToken(user);
  return {
    user: { ...user.toSafeObject(), role: 'user' },
    token,
    authType: 'user',
    destination: 'app',
    session: {
      loggedIn: true,
      email: user.email,
      userId: String(user._id),
      loggedInAt: new Date().toISOString(),
      token,
      backend: true,
      authType: 'user',
      role: 'user',
      destination: 'app',
    },
  };
}

function buildAdminAuthResponse(email) {
  const token = signAdminToken(email);
  return {
    user: { email, role: 'admin' },
    admin: { email, scope: 'admin', role: 'admin' },
    token,
    authType: 'admin',
    destination: 'admin',
    session: {
      loggedIn: true,
      email,
      loggedInAt: new Date().toISOString(),
      token,
      backend: true,
      authType: 'admin',
      role: 'admin',
      destination: 'admin',
    },
  };
}

async function validAdminPassword(password) {
  if (env.adminPasswordHash) {
    return bcrypt.compare(String(password || ''), env.adminPasswordHash);
  }
  if (env.adminPassword) {
    const submitted = Buffer.from(String(password || ''));
    const configured = Buffer.from(env.adminPassword);
    return submitted.length === configured.length && crypto.timingSafeEqual(submitted, configured);
  }
  throw new ApiError(500, 'Administrator authentication is not configured.');
}

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName?.trim()) throw new ApiError(400, 'Full name is required');
  if (!email?.trim()) throw new ApiError(400, 'Email is required');
  if (!password || String(password).length < 4) {
    throw new ApiError(400, 'Password must be at least 4 characters');
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === env.adminEmail) {
    throw new ApiError(409, 'This email is unavailable.');
  }
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new ApiError(409, 'An account already exists for this email.');

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    profile: profileFromName(fullName),
    lastLoginAt: new Date(),
  });

  res.status(201).json({
    success: true,
    message: 'Registered successfully',
    data: buildAuthResponse(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) throw new ApiError(400, 'Email and password are required');

  const normalizedEmail = normalizeEmail(email);
  if (env.nodeEnv !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[admin-auth] POST /api/auth/login admin email match: ${normalizedEmail === env.adminEmail ? 'yes' : 'no'}`);
  }
  if (normalizedEmail === env.adminEmail) {
    if (!env.adminEmail || !env.adminJwtSecret) {
      throw new ApiError(500, 'Administrator authentication is not configured.');
    }
    const passwordMatches = await validAdminPassword(password);
    if (env.nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[admin-auth] Admin password verification (${env.adminPasswordHash ? 'bcrypt hash' : 'development password fallback'}): ${passwordMatches ? 'passed' : 'failed'}`);
    }
    if (!passwordMatches) {
      throw new ApiError(401, 'Invalid email or password.');
    }
    await recordAdminAction({ req: { ...req, admin: { email: normalizedEmail } }, action: 'ADMIN_LOGIN', targetType: 'admin', summary: 'Administrator signed in' });
    const response = {
      success: true,
      message: 'Logged in',
      data: buildAdminAuthResponse(normalizedEmail),
    };
    if (env.nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[admin-auth] ADMIN_JWT_SECRET token creation: succeeded');
    }
    return res.json(response);
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const matches = await bcrypt.compare(String(password), user.passwordHash);
  if (!matches) throw new ApiError(401, 'Invalid email or password.');
  if (user.isSuspended) throw new ApiError(403, 'Account suspended');

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Logged in',
    data: buildAuthResponse(user),
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user.toSafeObject(),
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out',
  });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  if (!req.body?.email?.trim()) throw new ApiError(400, 'Email is required');
  const message = 'If an account supports password recovery, instructions will be sent.';
  res.json({ success: true, message, data: { message } });
});

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts' } });
const passwordResetRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many password recovery attempts' } });

module.exports = {
  register,
  login,
  me,
  logout,
  requestPasswordReset,
  loginRateLimit,
  passwordResetRateLimit,
};
