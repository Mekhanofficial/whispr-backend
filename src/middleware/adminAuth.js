const ApiError = require('../utils/ApiError');
const { verifyAdminToken } = require('../utils/adminToken');

function requireAdminAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new ApiError(401, 'Administrator authentication required');
    const decoded = verifyAdminToken(token);
    if (decoded.scope !== 'admin' || decoded.typ !== 'admin' || decoded.sub !== 'admin') {
      throw new ApiError(403, 'Administrator scope required');
    }
    req.admin = { email: String(decoded.email || '').toLowerCase(), scope: 'admin', token };
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, 'Invalid or expired administrator session'));
  }
}

module.exports = { requireAdminAuth };
