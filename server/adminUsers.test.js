import test from 'node:test';
import assert from 'node:assert/strict';
import { adminActivityPage, firebaseAccountReadError, publicAdminAccount } from './adminUsers.js';

test('admin account serialization allowlists identity fields and excludes credentials', () => {
  const account = publicAdminAccount({
    uid: 'user-1',
    email: 'user@example.com',
    passwordHash: 'must-not-leak',
    salt: 'must-not-leak',
    refreshToken: 'must-not-leak',
    providerData: [{
      providerId: 'google.com', uid: 'provider-1', email: 'provider@example.com',
      displayName: 'Provider user', password: 'must-not-leak', accessToken: 'must-not-leak',
    }],
    customClaims: { cohort: '2026', apiToken: 'must-not-leak', nested: { role: 'student', secretKey: 'must-not-leak' } },
    metadata: { creationTime: 'created', lastSignInTime: 'signed-in', lastRefreshTime: 'refreshed' },
  }, 'student');
  assert.deepEqual(account.providers, [{
    providerId: 'google.com', uid: 'provider-1', displayName: 'Provider user',
    email: 'provider@example.com', photoURL: null, phoneNumber: null,
  }]);
  assert.deepEqual(account.customClaims, { cohort: '2026', nested: { role: 'student' } });
  assert.equal(account.passwordHash, undefined);
  assert.equal(account.salt, undefined);
  assert.equal(account.refreshToken, undefined);
  assert.equal(account.metadata.creationTime, 'created');
  assert.equal(JSON.stringify(account).includes('must-not-leak'), false);
});

test('activity pagination returns at most 50 rows and signals another page only for row 51', () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({ id: String(index) }));
  const first = adminActivityPage(rows, 0);
  assert.equal(first.items.length, 50);
  assert.equal(first.items[49].id, '49');
  assert.equal(first.nextOffset, 50);

  const last = adminActivityPage(rows.slice(0, 50), 50);
  assert.equal(last.items.length, 50);
  assert.equal(last.nextOffset, null);
});

test('Firebase credential and permission failures are service failures, not owner-access denials', () => {
  for (const code of ['app/invalid-credential', 'auth/invalid-credential', 'auth/insufficient-permission']) {
    const error = firebaseAccountReadError({ code, message: 'private-key-must-not-leak' }, 'Read failed.');
    assert.equal(error.status, 503);
    assert.equal(error.firebaseCode, code);
    assert.equal(error.message.includes('private-key-must-not-leak'), false);
  }
});

test('invalid Firebase pagination is a client error and retains its safe error code', () => {
  const error = firebaseAccountReadError({ code: 'auth/invalid-page-token' }, 'Read failed.');
  assert.equal(error.status, 400);
  assert.equal(error.firebaseCode, 'auth/invalid-page-token');
});

test('unrecognized Firebase failures never expose raw upstream messages or arbitrary codes', () => {
  const error = firebaseAccountReadError({
    code: 'auth/internal-error private-key-must-not-leak',
    message: 'postgres://private-password@database.example',
  }, 'Read failed.');
  assert.equal(error.status, 500);
  assert.equal(error.firebaseCode, 'unknown');
  assert.equal(error.message.includes('private-key-must-not-leak'), false);
  assert.equal(error.message.includes('private-password'), false);
});
