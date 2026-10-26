const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { test, before, after } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '3600';

const app = require('../src/app');
const database = require('../src/config/database');
const userModel = require('../src/models/userModel');

const password = 'test-password-123';
let server;
let baseUrl;
let account;

before(async () => {
  account = userModel.create({
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: await bcrypt.hash(password, 10),
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
  database.close();
});

async function request(path, { method = 'POST', body, token } = {}) {
  const response = await fetch(`${baseUrl}/api/auth${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json();
  const serialized = JSON.stringify(json);
  assert.equal(serialized.includes('password_hash'), false);
  assert.equal(serialized.includes(password), false);
  assert.equal(typeof json.success, 'boolean');
  assert.equal(typeof json.message, 'string');
  assert.ok(Object.hasOwn(json, 'data'));
  if (!json.success) {
    assert.equal(json.data, null);
    assert.equal(json.errors, null);
  }
  return { status: response.status, body: json };
}

function assertPublicUser(user) {
  assert.deepEqual(Object.keys(user).sort(), ['created_at', 'email', 'id', 'username']);
}

test('Registration creates a user and stores a bcrypt hash only', async () => {
  const response = await request('/register', {
    body: { username: 'newuser', email: 'NEW@example.com', password },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assertPublicUser(response.body.data.user);
  assert.equal(response.body.data.user.email, 'new@example.com');
  const stored = userModel.findByEmail('new@example.com');
  assert.notEqual(stored.password_hash, password);
  assert.equal(await bcrypt.compare(password, stored.password_hash), true);
  assert.equal(Object.hasOwn(stored, 'password'), false);
});

for (const [name, body] of [
  ['missing fields', {}],
  ['missing username', { email: 'a@example.com', password }],
  ['missing email', { username: 'a', password }],
  ['missing password', { username: 'a', email: 'a@example.com' }],
  ['invalid email', { username: 'a', email: 'invalid', password }],
  ['short password', { username: 'a', email: 'a@example.com', password: 'short' }],
  ['over 72 UTF-8 bytes', { username: 'a', email: 'a@example.com', password: 'a'.repeat(73) }],
  ['incorrect field types', { username: {}, email: [], password: 12345678 }],
]) {
  test(`Registration rejects ${name}`, async () => {
    assert.equal((await request('/register', { body })).status, 400);
  });
}

for (const [name, username, email] of [
  ['username', 'TESTUSER', 'different@example.com'],
  ['email', 'differentuser', 'TEST@EXAMPLE.COM'],
]) {
  test(`Registration rejects duplicate ${name} ignoring case`, async () => {
    const result = await request('/register', { body: { username, email, password } });
    assert.equal(result.status, 409);
  });
}

test('Simultaneous duplicate registrations return 201 and 409', async () => {
  const body = { username: 'parallel', email: 'parallel@example.com', password };
  const results = await Promise.all([
    request('/register', { body }),
    request('/register', { body }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
});

test('Login returns a time-limited JWT and /me returns a public user', async () => {
  const response = await request('/login', { body: { email: 'TEST@example.com', password } });
  assert.equal(response.status, 200);
  const { accessToken, expiresIn, tokenType, user } = response.body.data;
  assert.equal(expiresIn, 3600);
  assert.equal(tokenType, 'Bearer');
  assertPublicUser(user);
  const payload = jwt.verify(accessToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  assert.equal(payload.sub, String(account.id));
  assert.equal(payload.exp - payload.iat, 3600);
  const me = await request('/me', { method: 'GET', token: accessToken });
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.data.user, account);
  assertPublicUser(me.body.data.user);
});

test('Wrong password and unknown email return the same generic 401', async () => {
  const wrongPassword = await request('/login', {
    body: { email: 'test@example.com', password: 'wrong-password' },
  });
  const unknownEmail = await request('/login', {
    body: { email: 'absent@example.com', password },
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(wrongPassword.body, unknownEmail.body);
});

test('Login rejects missing information with 400', async () => {
  assert.equal((await request('/login', { body: {} })).status, 400);
});

for (const type of ['missing', 'invalid', 'expired', 'wrong signature', 'wrong algorithm', 'deleted user']) {
  test(`/me rejects ${type} token with 401`, async () => {
    let token;
    if (type === 'invalid') token = 'not-a-token';
    if (type === 'expired') {
      token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(account.id), expiresIn: -1 });
    }
    if (type === 'wrong signature') {
      token = jwt.sign({}, randomBytes(32).toString('hex'), { subject: String(account.id), expiresIn: 60 });
    }
    if (type === 'wrong algorithm') {
      token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(account.id), expiresIn: 60, algorithm: 'HS384' });
    }
    if (type === 'deleted user') {
      token = jwt.sign({}, process.env.JWT_SECRET, { subject: '999999', expiresIn: 60 });
    }
    assert.equal((await request('/me', { method: 'GET', token })).status, 401);
  });
}

test('Database failures return generic 500 without exposing database details', async (t) => {
  t.mock.method(userModel, 'findByEmail', () => {
    throw new Error('SQLITE_ERROR: private database details');
  });
  const response = await request('/login', { body: { email: 'test@example.com', password } });
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'Loi server');
});
