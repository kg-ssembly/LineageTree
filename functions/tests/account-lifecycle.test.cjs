const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateUnusedAccount } = require('../lib/functions/src/services/account-lifecycle-function');

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 22);
const base = {
  createdAtMs: now - 121 * day,
  lastSignInAtMs: now - 121 * day + 5 * 60 * 1000,
  lastActiveAtMs: now - 121 * day + 10 * 60 * 1000,
  nowMs: now,
  unusedDays: 90,
  hasProductFootprint: false,
  hasWarningChannel: true,
};

test('old untouched account is eligible', () => {
  assert.deepEqual(evaluateUnusedAccount(base), { eligible: true, reason: 'eligible' });
});

test('recent, returning, used and unreachable accounts are blocked', () => {
  assert.equal(evaluateUnusedAccount({ ...base, createdAtMs: now - 20 * day }).reason, 'too-new');
  assert.equal(evaluateUnusedAccount({ ...base, lastActiveAtMs: now - 20 * day }).reason, 'returned-after-registration');
  assert.equal(evaluateUnusedAccount({ ...base, hasProductFootprint: true }).reason, 'product-footprint');
  assert.equal(evaluateUnusedAccount({ ...base, hasWarningChannel: false }).reason, 'warning-channel-unavailable');
  assert.equal(evaluateUnusedAccount({ ...base, createdAtMs: Number.NaN }).reason, 'invalid-metadata');
});

test('activity after the initial registration day permanently distinguishes a returning account', () => {
  assert.equal(evaluateUnusedAccount({ ...base, lastSignInAtMs: base.createdAtMs + day + 1 }).eligible, false);
});
