const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signAccessToken } = require('../utils/token');

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
    user: user.toSafeObject(),
    token,
    session: {
      loggedIn: true,
      email: user.email,
      userId: String(user._id),
      loggedInAt: new Date().toISOString(),
      token,
      backend: true,
    },
  };
}

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName?.trim()) throw new ApiError(400, 'Full name is required');
  if (!email?.trim()) throw new ApiError(400, 'Email is required');
  if (!password || String(password).length < 4) {
    throw new ApiError(400, 'Password must be at least 4 characters');
  }

  const normalizedEmail = normalizeEmail(email);
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
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const matches = await bcrypt.compare(String(password), user.passwordHash);
  if (!matches) throw new ApiError(401, 'Invalid email or password.');

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

module.exports = {
  register,
  login,
  me,
  logout,
};
