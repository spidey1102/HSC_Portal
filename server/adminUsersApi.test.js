import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminUsersHandler } from './adminUsersHandler.js';

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); },
  };
}

function request(method = 'GET', query = {}) {
  return { method, query };
}

test('admin account API authenticates before any account or source lookup', async () => {
  let ownerChecks = 0;
  let accountReads = 0;
  const handler = createAdminUsersHandler({
    authenticate: async () => { throw new Error('invalid token'); },
    ownerCheck: () => { ownerChecks += 1; return true; },
    listUsers: async () => { accountReads += 1; },
    getDetail: async () => { accountReads += 1; },
  });
  const res = responseRecorder();
  await handler(request(), res);
  assert.equal(res.statusCode, 401);
  assert.equal(ownerChecks, 0);
  assert.equal(accountReads, 0);
  assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
  assert.deepEqual(res.body, { error: 'A valid sign-in is required.' });
});

test('admin account API denies posters before account or source lookup', async () => {
  let accountReads = 0;
  const handler = createAdminUsersHandler({
    authenticate: async () => ({ uid: 'poster' }),
    ownerCheck: () => false,
    listUsers: async () => { accountReads += 1; },
    getDetail: async () => { accountReads += 1; },
  });
  const res = responseRecorder();
  await handler(request(), res);
  assert.equal(res.statusCode, 403);
  assert.equal(accountReads, 0);
  assert.equal(res.body.error, 'Owner access is required.');
});

test('admin account API only permits GET and marks private responses no-store', async () => {
  let authenticationCalls = 0;
  const handler = createAdminUsersHandler({ authenticate: async () => { authenticationCalls += 1; } });
  const res = responseRecorder();
  await handler(request('POST'), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
  assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(authenticationCalls, 0);
});

test('owner requests reject ambiguous account queries without reading private data', async () => {
  let accountReads = 0;
  const handler = createAdminUsersHandler({
    authenticate: async () => ({ uid: 'owner' }),
    ownerCheck: () => true,
    listUsers: async () => { accountReads += 1; },
    getDetail: async () => { accountReads += 1; },
  });
  for (const query of [
    { uid: ['first-account', 'second-account'] },
    { uid: 'account', section: 'submissions', offset: '-1' },
    { uid: 'account', pageToken: 'next-page' },
  ]) {
    const res = responseRecorder();
    await handler(request('GET', query), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(accountReads, 0);
});

test('upstream failures do not expose credentials or database details to the owner', async () => {
  const handler = createAdminUsersHandler({
    authenticate: async () => ({ uid: 'owner' }),
    ownerCheck: () => true,
    getDetail: async () => { throw new Error('postgres://private-password@database.example/private'); },
  });
  const res = responseRecorder();
  await handler(request('GET', { uid: 'account' }), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Account inspection could not be completed.' });
});
