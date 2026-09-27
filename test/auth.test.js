const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'unified-login-test-secret-with-more-than-thirty-two-characters';
process.env.ADMIN_EMAIL = 'unified-admin@example.test';
process.env.ADMIN_PASSWORD = 'unified-admin-password';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 4);
process.env.ADMIN_JWT_SECRET = 'unified-admin-test-secret-with-more-than-thirty-two-characters';

const User = require('../src/models/User');
const AdminAuditLog = require('../src/models/AdminAuditLog');
const { login, register } = require('../src/controllers/authController');
const { requireAdminAuth } = require('../src/middleware/adminAuth');
const { verifyAdminToken } = require('../src/utils/adminToken');
const { signAccessToken } = require('../src/utils/token');
const adminAuthController = require('../src/controllers/adminAuthController');

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, value }); return this; },
    };
    handler(req, res, reject);
  });
}

function invokeMiddleware(handler, req) {
  return new Promise((resolve, reject) => handler(req, {}, (error) => error ? reject(error) : resolve(req)));
}

test('unified login sends admin credentials to the admin destination', async () => {
  const originalAuditCreate = AdminAuditLog.create;
  const originalFindOne = User.findOne;
  let auditAction = '';
  AdminAuditLog.create = async (entry) => { auditAction = entry.action; return entry; };
  User.findOne = async () => { throw new Error('Admin login must not query the normal user collection'); };
  try {
    const response = await invoke(login, { body: { email: `  ${process.env.ADMIN_EMAIL.toUpperCase()}  `, password: process.env.ADMIN_PASSWORD } });
    assert.equal(response.status, 200);
    assert.equal(response.value.data.authType, 'admin');
    assert.equal(response.value.data.destination, 'admin');
    assert.equal(response.value.data.user.role, 'admin');
    assert.equal(verifyAdminToken(response.value.data.token).scope, 'admin');
    const adminRequest = await invokeMiddleware(requireAdminAuth, { headers: { authorization: `Bearer ${response.value.data.token}` } });
    const adminMe = await invoke(adminAuthController.me, adminRequest);
    assert.equal(adminMe.status, 200);
    assert.equal(adminMe.value.data.admin.scope, 'admin');
    assert.equal(auditAction, 'ADMIN_LOGIN');
  } finally {
    AdminAuditLog.create = originalAuditCreate;
    User.findOne = originalFindOne;
  }
});

test('wrong admin password returns the same generic login error', async () => {
  await assert.rejects(
    invoke(login, { body: { email: process.env.ADMIN_EMAIL, password: 'wrong-password' } }),
    (error) => error.statusCode === 401 && error.message === 'Invalid email or password.'
  );
});

test('admin password fallback works when the development hash is absent', async () => {
  const env = require('../src/config/env');
  const originalAuditCreate = AdminAuditLog.create;
  const originalHash = env.adminPasswordHash;
  const originalPassword = env.adminPassword;
  env.adminPasswordHash = '';
  env.adminPassword = process.env.ADMIN_PASSWORD;
  AdminAuditLog.create = async (entry) => entry;
  try {
    const response = await invoke(login, { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
    assert.equal(response.status, 200);
    assert.equal(response.value.data.user.role, 'admin');
  } finally {
    AdminAuditLog.create = originalAuditCreate;
    env.adminPasswordHash = originalHash;
    env.adminPassword = originalPassword;
  }
});

test('missing admin hash and password return a controlled configuration error', async () => {
  const env = require('../src/config/env');
  const originalHash = env.adminPasswordHash;
  const originalPassword = env.adminPassword;
  env.adminPasswordHash = '';
  env.adminPassword = '';
  try {
    await assert.rejects(
      invoke(login, { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } }),
      (error) => error.statusCode === 500 && error.message === 'Administrator authentication is not configured.'
    );
  } finally {
    env.adminPasswordHash = originalHash;
    env.adminPassword = originalPassword;
  }
});

test('normal user login returns a user destination and cannot create an admin token', async () => {
  const originalFindOne = User.findOne;
  const passwordHash = await bcrypt.hash('user-password', 4);
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email: 'poet@example.test',
    passwordHash,
    isSuspended: false,
    toSafeObject: () => ({ id: '507f1f77bcf86cd799439011', email: 'poet@example.test' }),
    save: async () => {},
  };
  User.findOne = () => ({ select: async () => user });
  try {
    const response = await invoke(login, { body: { email: user.email, password: 'user-password' } });
    assert.equal(response.status, 200);
    assert.equal(response.value.data.authType, 'user');
    assert.equal(response.value.data.destination, 'app');
    assert.equal(response.value.data.user.role, 'user');
    await assert.rejects(invokeMiddleware(requireAdminAuth, { headers: { authorization: `Bearer ${response.value.data.token}` } }));
  } finally {
    User.findOne = originalFindOne;
  }
});

test('admin email is reserved from normal registration', async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => { throw new Error('User lookup should not run for the reserved admin email'); };
  try {
    await assert.rejects(
      invoke(register, { body: { fullName: 'Admin Collision', email: process.env.ADMIN_EMAIL, password: 'user-password' } }),
      (error) => error.statusCode === 409 && error.message === 'This email is unavailable.'
    );
  } finally {
    User.findOne = originalFindOne;
  }
});
