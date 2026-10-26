const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { test, before, beforeEach, after } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '3600';

const app = require('../src/app');
const database = require('../src/config/database');
const newsModel = require('../src/models/newsModel');
const input = { title: 'Tin moi', content: 'Noi dung moi' };
let server;
let baseUrl;
let ownerId;
let otherId;
let ownerToken;
let otherToken;
let newsId;

before(async () => {
  const insertUser = database.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
  );
  ownerId = Number(insertUser.run('owner', 'owner@example.com', 'private-test-hash').lastInsertRowid);
  otherId = Number(insertUser.run('other', 'other@example.com', 'private-test-hash').lastInsertRowid);
  ownerToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(ownerId), expiresIn: 3600 });
  otherToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(otherId), expiresIn: 3600 });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  database.prepare('DELETE FROM news').run();
  newsId = Number(database.prepare(`
    INSERT INTO news (title, content, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('Tin cu', 'Noi dung cu', ownerId, '2020-01-01 00:00:00', '2020-01-01 00:00:00').lastInsertRowid);
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

async function request(method, path, body, token = ownerToken) {
  const response = await fetch(`${baseUrl}/api/news${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json();
  assert.equal(typeof json.success, 'boolean');
  assert.equal(typeof json.message, 'string');
  for (const secret of ['password_hash', 'private-test-hash', '"email"', 'SQLITE', 'stack']) {
    assert.equal(JSON.stringify(json).includes(secret), false);
  }
  if (!json.success) {
    assert.equal(json.data, null);
    assert.equal(json.errors, null);
  }
  return { status: response.status, body: json };
}

test('POST creates news with the authenticated author, ignoring client author_id', async () => {
  const result = await request('POST', '', { ...input, author_id: otherId });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.news.title, input.title);
  assert.equal(result.body.data.news.content, input.content);
  assert.deepEqual(result.body.data.news.author, { id: ownerId, username: 'owner' });
  assert.ok(result.body.data.news.created_at);
  assert.ok(result.body.data.news.updated_at);
  const publicResult = await request('GET', `/${result.body.data.news.id}`, undefined, null);
  assert.equal(publicResult.status, 200);
  assert.deepEqual(publicResult.body.data.news, result.body.data.news);
});

test('PUT updates own news, timestamp and content without changing author or created_at', async () => {
  const result = await request('PUT', `/${newsId}`, { ...input, author_id: otherId });
  assert.equal(result.status, 200);
  const news = result.body.data.news;
  assert.equal(news.id, newsId);
  assert.equal(news.title, input.title);
  assert.equal(news.content, input.content);
  assert.equal(news.created_at, '2020-01-01 00:00:00');
  assert.ok(news.updated_at > '2020-01-01 00:00:00');
  assert.equal(news.author.id, ownerId);
  assert.deepEqual(newsModel.findById(newsId), news);
});

test('DELETE removes own news and returns a standard HTTP 200 response', async () => {
  const result = await request('DELETE', `/${newsId}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.deepEqual(result.body.data, { id: newsId });
  assert.equal(newsModel.findById(newsId), null);
  assert.equal((await request('GET', `/${newsId}`, undefined, null)).status, 404);
});

for (const method of ['POST', 'PUT', 'DELETE']) {
  for (const type of ['missing', 'invalid', 'expired']) {
    test(`${method} rejects ${type} JWT with 401 and preserves data`, async () => {
      const before = database.prepare('SELECT * FROM news ORDER BY id').all();
      let token = null;
      if (type === 'invalid') token = 'invalid-token';
      if (type === 'expired') {
        token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(ownerId), expiresIn: -1 });
      }
      const result = await request(method, method === 'POST' ? '' : `/${newsId}`, input, token);
      assert.equal(result.status, 401);
      assert.deepEqual(database.prepare('SELECT * FROM news ORDER BY id').all(), before);
    });
  }
}

for (const method of ['POST', 'PUT']) {
  for (const [name, body] of [
    ['missing body', undefined], ['missing fields', {}], ['array body', []],
    ['blank title', { title: '  ', content: 'Noi dung' }],
    ['blank content', { title: 'Tieu de', content: '\n\t' }],
    ['numeric title', { title: 123, content: 'Noi dung' }],
    ['object content', { title: 'Tieu de', content: {} }],
    ['null title', { title: null, content: 'Noi dung' }],
    ['missing content', { title: 'Tieu de' }],
  ]) {
    test(`${method} rejects ${name} with 400 without writing`, async () => {
      const before = database.prepare('SELECT * FROM news ORDER BY id').all();
      assert.equal((await request(method, method === 'POST' ? '' : `/${newsId}`, body)).status, 400);
      assert.deepEqual(database.prepare('SELECT * FROM news ORDER BY id').all(), before);
    });
  }
}

for (const method of ['PUT', 'DELETE']) {
  test(`${method} rejects another author with 403 and preserves the row`, async () => {
    const before = newsModel.findById(newsId);
    const result = await request(method, `/${newsId}`, { ...input, author_id: otherId }, otherToken);
    assert.equal(result.status, 403);
    assert.deepEqual(newsModel.findById(newsId), before);
  });

  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992', '1%20OR%201=1']) {
    test(`${method} rejects invalid ID ${id} with 400`, async () => {
      assert.equal((await request(method, `/${id}`, input)).status, 400);
      assert.ok(newsModel.findById(newsId));
    });
  }

  test(`${method} returns 404 for nonexistent news`, async () => {
    assert.equal((await request(method, '/999999', input)).status, 404);
  });
}

test('Failed update rolls back the write and hides database details', async () => {
  const before = newsModel.findById(newsId);
  database.exec(`
    CREATE TEMP TRIGGER fail_news_update AFTER UPDATE ON news
    BEGIN SELECT RAISE(ABORT, 'private database error'); END;
  `);
  try {
    const result = await request('PUT', `/${newsId}`, input);
    assert.equal(result.status, 500);
    assert.equal(result.body.message, 'Loi server');
    assert.deepEqual(newsModel.findById(newsId), before);
  } finally {
    database.exec('DROP TRIGGER fail_news_update');
  }
});

for (const [httpMethod, modelMethod] of [['POST', 'create'], ['DELETE', 'remove']]) {
  test(`${httpMethod} database failures return generic 500`, async (t) => {
    t.mock.method(newsModel, modelMethod, () => {
      throw new Error('private database error');
    });
    const result = await request(httpMethod, httpMethod === 'POST' ? '' : `/${newsId}`, input);
    assert.equal(result.status, 500);
    assert.equal(result.body.message, 'Loi server');
  });
}

test('Public list and detail remain accessible without JWT after private edits', async () => {
  await request('PUT', `/${newsId}`, input);
  const list = await request('GET', '', undefined, null);
  const detail = await request('GET', `/${newsId}`, undefined, null);
  assert.equal(list.status, 200);
  assert.equal(detail.status, 200);
  assert.deepEqual(list.body.data.news[0], detail.body.data.news);
});
