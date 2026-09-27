const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/token');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new ApiError(401, 'Invalid session');
    }
    if (user.isSuspended) throw new ApiError(403, 'Account suspended');

    req.auth = { userId: String(user._id), token, decoded };
    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = {
  requireAuth,
  optionalAuth(req, res, next) {
    if (!req.headers.authorization) return next();
    return requireAuth(req, res, next);
  },
  requireAdmin(req, res, next) {
    const env = require('../config/env');
    if (req.user?.isAdmin || env.adminEmails.includes(String(req.user?.email || '').toLowerCase())) return next();
    return next(new ApiError(403, 'Administrator access required'));
  },
};
