const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test, after } = require('node:test');
const { randomBytes } = require('node:crypto');

// Set before importing the app: never open the real database during tests.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const express = require('express');
const app = require('../src/app');
const errorHandler = require('../src/middlewares/errorHandler');
const database = require('../src/config/database');

after(() => database.close());

async function withServer(application, run) {
  const server = application.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}

for (const path of ['/health', '/api/health']) {
  test(`GET ${path} returns HTTP 200 with a standard response`, async () => {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}${path}`);

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.deepEqual(await response.json(), {
        success: true,
        message: 'Server is running',
        data: { status: 'ok' },
      });
    });
  });
}

test('An unknown route returns HTTP 404 with a standard error', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/does-not-exist`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Khong tim thay API',
      data: null,
      errors: null,
    });
  });
});

test('Malformed JSON returns HTTP 400 instead of HTTP 500', async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'JSON khong hop le',
      data: null,
      errors: null,
    });
  });
});

test('Unexpected errors return HTTP 500 without exposing internal details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const testApp = express();

  // This route exists only in the test application, never in src/app.js.
  testApp.get('/test-error', () => {
    throw new Error('Internal details that must not appear in the response');
  });
  testApp.use(errorHandler);

  await withServer(testApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/test-error`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Loi server',
      data: null,
      errors: null,
    });
  });
});
