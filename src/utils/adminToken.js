const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAdminToken(email) {
  return jwt.sign({ sub: 'admin', email, scope: 'admin', typ: 'admin' }, env.adminJwtSecret, { expiresIn: env.adminSessionExpiresIn });
}

function verifyAdminToken(token) {
  return jwt.verify(token, env.adminJwtSecret);
}

module.exports = { signAdminToken, verifyAdminToken };
