const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { test, before, after } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '3600';

const app = require('../src/app');
const database = require('../src/config/database');
let server;
let baseUrl;
let fixtures;

before(async () => {
  const authorId = database.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
  ).run('author', 'private@example.com', 'private-test-hash').lastInsertRowid;
  const insert = database.prepare(`
    INSERT INTO news (title, content, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  fixtures = [
    ['Alpha NodeJS', 'First article', '2026-10-01 10:00:00', '2026-10-06 10:00:00'],
    ['Beta', 'Learn nodejs today', '2026-10-03 10:00:00', '2026-10-04 10:00:00'],
    ['Alpha NodeJS', 'Another nodejs article', '2026-10-03 10:00:00', '2026-10-04 10:00:00'],
    ['Gamma', 'SQLite tutorial', '2026-10-02 10:00:00', '2026-10-05 10:00:00'],
    ['Literal symbols', '100% ready_under C:\\docs', '2026-10-05 10:00:00', '2026-10-07 10:00:00'],
  ].map(([title, content, createdAt, updatedAt]) => ({
    id: Number(insert.run(title, content, authorId, createdAt, updatedAt).lastInsertRowid),
    title, content, created_at: createdAt, updated_at: updatedAt,
  }));
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

async function get(query = '') {
  // Deliberately no Authorization: all search/sort requests must remain public.
  const response = await fetch(`${baseUrl}/api/news${query ? `?${query}` : ''}`);
  const body = await response.json();
  for (const privateValue of ['password_hash', 'private-test-hash', 'private@example.com', 'SQLITE']) {
    assert.equal(JSON.stringify(body).includes(privateValue), false);
  }
  return { status: response.status, body };
}

test('Search matches part of the title with ASCII case insensitivity', async () => {
  const result = await get('search=PHA%20node');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.news.map((news) => news.id), [fixtures[2].id, fixtures[0].id]);
  assert.equal(result.body.data.pagination.total, 2);
});

test('Search matches part of content', async () => {
  const result = await get('search=learn%20NODE');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.news.map((news) => news.id), [fixtures[1].id]);
});

test('No matches return HTTP 200 with an empty array and zero total', async () => {
  const result = await get('search=not-present');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, {
    news: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });
});

test('A match in both title and content counts the article only once', async () => {
  const result = await get('search=NODEJS');
  assert.equal(result.body.data.pagination.total, 3);
  assert.equal(result.body.data.news.length, 3);
});

for (const search of ['', '   ']) {
  test(`Empty or whitespace-only search ${JSON.stringify(search)} returns the normal list`, async () => {
    assert.deepEqual((await get(`search=${encodeURIComponent(search)}`)).body, (await get()).body);
  });
}

test('Search trims surrounding whitespace', async () => {
  assert.deepEqual((await get('search=%20nodejs%20')).body, (await get('search=nodejs')).body);
});

for (const search of ['%', '_', '\\']) {
  test(`Search treats ${search} literally rather than as a wildcard`, async () => {
    const result = await get(`search=${encodeURIComponent(search)}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.news.map((news) => news.id), [fixtures[4].id]);
  });
}

for (const sortBy of ['created_at', 'updated_at', 'title']) {
  for (const order of ['asc', 'desc']) {
    test(`Sort by ${sortBy} ${order} uses id as a stable tie breaker`, async () => {
      const direction = order === 'asc' ? 1 : -1;
      const expected = [...fixtures].sort((a, b) => {
        const comparison = a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : 0;
        return direction * (comparison || a.id - b.id);
      });
      const result = await get(`sortBy=${sortBy}&order=${order}`);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.data.news.map((news) => news.id), expected.map((news) => news.id));
    });
  }
}

test('Default order stays created_at DESC, id DESC', async () => {
  const result = await get();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, (await get('sortBy=created_at&order=desc')).body);
});

test('Each sort parameter works independently', async () => {
  assert.deepEqual((await get('sortBy=title')).body, (await get('sortBy=title&order=desc')).body);
  assert.deepEqual((await get('order=asc')).body, (await get('sortBy=created_at&order=asc')).body);
});

test('Search, sorting and pagination combine with correct filtered totals', async () => {
  const result = await get('search=nodejs&sortBy=title&order=asc&page=2&limit=2');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.news.map((news) => news.id), [fixtures[1].id]);
  assert.deepEqual(result.body.data.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
});

test('Tied sort values remain stable across adjacent pages', async () => {
  const first = await get('search=nodejs&sortBy=title&order=asc&page=1&limit=1');
  const second = await get('search=nodejs&sortBy=title&order=asc&page=2&limit=1');
  assert.deepEqual(first.body.data.news.map((news) => news.id), [fixtures[0].id]);
  assert.deepEqual(second.body.data.news.map((news) => news.id), [fixtures[2].id]);
});

test('Filtered page past the last page returns an empty array with the same total', async () => {
  const result = await get('search=nodejs&page=3&limit=2');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.news, []);
  assert.deepEqual(result.body.data.pagination, { page: 3, limit: 2, total: 3, totalPages: 2 });
});

for (const query of [
  'sortBy=id', 'sortBy=', 'sortBy=constructor', 'sortBy=title&sortBy=created_at',
  'order=up', 'order=', 'order=ASC', 'order=asc&order=desc',
  'search=nodejs&search=sqlite', `search=${'a'.repeat(201)}`, 'search=%00',
  'sortBy=title%3B%20DROP%20TABLE%20news%3B--', 'order=desc%3B%20DELETE%20FROM%20users',
]) {
  test(`Invalid query ${query.slice(0, 75)} returns HTTP 400`, async () => {
    const result = await get(query);
    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(result.body.data, null);
    assert.equal(result.body.errors, null);
  });
}

for (const search of ["' OR 1=1 --", "'; DROP TABLE news; --"]) {
  test(`SQL-like search ${search} stays literal and preserves the database`, async () => {
    const result = await get(`search=${encodeURIComponent(search)}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.news, []);
    assert.equal(result.body.data.pagination.total, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM news').get().total, fixtures.length);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM users').get().total, 1);
  });
}
