const { test } = require('node:test');
const assert = require('node:assert/strict');
const { effectiveStatus } = require('../src/middleware/privateAccess');
const { addCycle } = require('../src/controllers/privateAccessController');

test('private entitlement states preserve paid time for cancelled subscriptions', () => {
  const future = new Date(Date.now() + 86400000);
  assert.equal(effectiveStatus({ status: 'cancelled', expiresAt: future }), 'active');
  assert.equal(effectiveStatus({ status: 'active', expiresAt: new Date(Date.now() - 86400000), graceUntil: future }), 'grace');
  assert.equal(effectiveStatus({ status: 'active', expiresAt: new Date(Date.now() - 86400000), graceUntil: new Date(Date.now() - 1) }), 'expired');
});

test('renewal adds the selected duration from the existing expiration date', () => {
  const start = new Date('2026-10-25T00:00:00.000Z');
  assert.equal(addCycle(start, 'monthly').toISOString(), '2026-11-25T00:00:00.000Z');
  assert.equal(addCycle(start, 'yearly').toISOString(), '2027-10-25T00:00:00.000Z');
});
