const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const { validateJwtSecret } = require('../src/config/env');
const { isPrivateFolder } = require('../src/middleware/upload');
const User = require('../src/models/User');
const { signAccessToken } = require('../src/utils/token');
const app = require('../src/app');

test('JWT secret rejects missing and known default values', () => {
  for (const value of ['', 'change-me', 'secret', 'replace-with-a-secret']) {
    assert.throws(() => validateJwtSecret(value), /missing or insecure/);
  }
  assert.throws(() => validateJwtSecret('short', 'production'), /at least 32/);
  assert.equal(validateJwtSecret(process.env.JWT_SECRET, 'production'), process.env.JWT_SECRET);
});

test('public upload folders reject private vault names', () => {
  for (const value of ['vault', 'vault_user123', 'vault-data', 'vault/data', 'private', 'private_backup', 'private-data', ' VaUlT_test ']) {
    assert.equal(isPrivateFolder(value), true);
  }
  assert.equal(isPrivateFolder('poem_images'), false);
});

test('private static upload URLs are denied and vault upload requires authentication', async () => {
  const originalFindById = User.findById;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const privateResponse = await fetch(`${base}/uploads/vault_account/plaintext.jpg`);
    assert.equal(privateResponse.status, 404);
    assert.equal((await fetch(`${base}/uploads/private-data/plaintext.jpg`)).status, 404);
    const uploadResponse = await fetch(`${base}/api/uploads/vault`, { method: 'POST' });
    assert.equal(uploadResponse.status, 401);
    User.findById = async () => ({ _id: '507f1f77bcf86cd799439011', email: 'test@example.com' });
    const token = signAccessToken({ _id: '507f1f77bcf86cd799439011', email: 'test@example.com' });
    const blockedUpload = await fetch(`${base}/api/uploads/vault`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(blockedUpload.status, 410);
    assert.match((await blockedUpload.json()).message, /disabled/);
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
  } finally {
    User.findById = originalFindById;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
