const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { test, before, beforeEach, after } = require('node:test');

// Set before importing app so no real database is opened or modified.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '3600';

const app = require('../src/app');
const database = require('../src/config/database');
const newsModel = require('../src/models/newsModel');
let server;
let baseUrl;
let authorId;

before(async () => {
  // A dummy hash is sufficient: this fixture is never used for login.
  const result = database.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
  ).run('news-author', 'private@example.com', 'private-test-hash');
  authorId = Number(result.lastInsertRowid);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => database.prepare('DELETE FROM news').run());

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
  database.close();
});

function seedNews() {
  const insert = database.prepare(`
    INSERT INTO news (title, content, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  return [
    ['Tin cu', 'Noi dung cu', '2026-10-01 10:00:00'],
    ['Tin moi A', 'Noi dung A', '2026-10-02 10:00:00'],
    ['Tin moi B', 'Noi dung B', '2026-10-02 10:00:00'],
  ].map(([title, content, date]) => Number(
    insert.run(title, content, authorId, date, date).lastInsertRowid,
  ));
}

async function get(path, headers = {}) {
  const response = await fetch(`${baseUrl}/api/news${path}`, { headers });
  const body = await response.json();
  const serialized = JSON.stringify(body);
  for (const privateValue of ['password_hash', 'private-test-hash', 'private@example.com', '"email"']) {
    assert.equal(serialized.includes(privateValue), false);
  }
  assert.equal(typeof body.success, 'boolean');
  assert.equal(typeof body.message, 'string');
  if (!body.success) {
    assert.equal(body.data, null);
    assert.equal(body.errors, null);
  }
  return { status: response.status, body };
}

function assertNews(news) {
  assert.deepEqual(Object.keys(news).sort(), [
    'author', 'content', 'created_at', 'id', 'title', 'updated_at',
  ]);
  assert.deepEqual(news.author, { id: authorId, username: 'news-author' });
}

test('Empty database returns HTTP 200 and an empty news array', async () => {
  const result = await get('');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, {
    news: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });
});

test('Public list returns newest first, with id as a stable tie breaker', async () => {
  const ids = seedNews();
  const result = await get('');
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.deepEqual(result.body.data.news.map((news) => news.id), [...ids].reverse());
  result.body.data.news.forEach(assertNews);
  assert.deepEqual(result.body.data.pagination, { page: 1, limit: 10, total: 3, totalPages: 1 });
});

test('Public detail returns all expected fields without user secrets', async () => {
  const [id] = seedNews();
  const result = await get(`/${id}`);
  assert.equal(result.status, 200);
  assertNews(result.body.data.news);
  assert.equal(result.body.data.news.id, id);
  assert.equal(result.body.data.news.title, 'Tin cu');
  assert.equal(result.body.data.news.content, 'Noi dung cu');
});

test('Public endpoints work even with an invalid Authorization header', async () => {
  const [id] = seedNews();
  const headers = { Authorization: 'Bearer invalid-token' };
  assert.equal((await get('', headers)).status, 200);
  assert.equal((await get(`/${id}`, headers)).status, 200);
});

test('Pagination selects the requested slice and returns totals', async () => {
  const [oldestId] = seedNews();
  const result = await get('?page=2&limit=2');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.news.map((news) => news.id), [oldestId]);
  assert.deepEqual(result.body.data.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
});

test('Page beyond the final page returns 200 with an empty array', async () => {
  seedNews();
  const result = await get('?page=3&limit=2');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.news, []);
  assert.equal(result.body.data.pagination.total, 3);
});

test('Limit 100 is accepted', async () => {
  assert.equal((await get('?limit=100')).status, 200);
});

for (const query of [
  'page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=', 'page=1e2',
  'page=9007199254740992', 'page=9007199254740991&limit=100',
  'page=1&page=2', 'limit=0', 'limit=-1', 'limit=1.5', 'limit=abc',
  'limit=', 'limit=101', 'limit=10&limit=20', 'limit=1%20OR%201=1',
]) {
  test(`Invalid pagination ${query} returns HTTP 400`, async () => {
    assert.equal((await get(`?${query}`)).status, 400);
  });
}

for (const id of ['abc', '0', '-1', '1.5', '1e2', '9007199254740992', '1%20OR%201=1']) {
  test(`Invalid ID ${id} returns HTTP 400`, async () => {
    assert.equal((await get(`/${id}`)).status, 400);
  });
}

test('Missing news returns HTTP 404', async () => {
  const result = await get('/999999');
  assert.equal(result.status, 404);
  assert.equal(result.body.message, 'Khong tim thay tin tuc');
});

for (const [path, method] of [['', 'count'], ['/1', 'findById']]) {
  test(`Database error for ${path || 'list'} returns generic HTTP 500`, async (t) => {
    t.mock.method(newsModel, method, () => {
      throw new Error('SQLITE_ERROR: private query details');
    });
    const result = await get(path);
    assert.equal(result.status, 500);
    assert.equal(result.body.message, 'Loi server');
    assert.equal(JSON.stringify(result.body).includes('SQLITE'), false);
  });
}

test('News author foreign key is enforced', () => {
  assert.throws(() => database.prepare(
    'INSERT INTO news (title, content, author_id) VALUES (?, ?, ?)',
  ).run('Tin test', 'Noi dung', 999999), { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
});
