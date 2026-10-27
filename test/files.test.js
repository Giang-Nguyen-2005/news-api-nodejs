const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { test, before, beforeEach, after } = require('node:test');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const uploadsParent = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadsParent, { recursive: true });
const temporaryRoot = fs.mkdtempSync(path.join(uploadsParent, 'test-files-'));
const uploadRoot = path.join(temporaryRoot, 'storage');
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '3600';
process.env.UPLOAD_DIR = uploadRoot;

const app = require('../src/app');
const database = require('../src/config/database');
const fileModel = require('../src/models/fileModel');
const { maxFileSize } = require('../src/config/files');
let server;
let baseUrl;
let ownerId;
let otherId;
let token;
let otherToken;
let images;

before(async () => {
  const insert = database.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
  ownerId = Number(insert.run('owner', 'owner@example.com', 'private-test-hash').lastInsertRowid);
  otherId = Number(insert.run('other', 'other@example.com', 'private-test-hash').lastInsertRowid);
  token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(ownerId), expiresIn: 3600 });
  otherToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(otherId), expiresIn: 3600 });
  images = {};
  for (const format of ['jpeg', 'png', 'webp', 'gif']) {
    images[format] = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 100, b: 200 } },
    }).toFormat(format).toBuffer();
  }
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  database.prepare('DELETE FROM files').run();
  if (fs.existsSync(uploadRoot)) {
    for (const filename of fs.readdirSync(uploadRoot)) {
      const target = path.resolve(uploadRoot, filename);
      assert.equal(path.dirname(target), uploadRoot);
      fs.unlinkSync(target);
    }
  }
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
  database.close();
  // This mkdtemp directory must remain a direct child of project/uploads.
  assert.equal(path.dirname(path.resolve(temporaryRoot)), uploadsParent);
  fs.rmSync(temporaryRoot, { recursive: true });
});

function form(buffer = images.png, filename = 'sample.png', mimetype = 'image/png', field = 'file') {
  const data = new FormData();
  data.append(field, new Blob([buffer], { type: mimetype }), filename);
  return data;
}

async function request(method, url, body, accessToken = token) {
  const response = await fetch(`${baseUrl}/api/files${url}`, {
    method,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    ...(body ? { body } : {}),
  });
  const json = await response.json();
  for (const privateValue of [process.env.JWT_SECRET, temporaryRoot, 'private-test-hash', 'SQLITE', '"stack"']) {
    assert.equal(JSON.stringify(json).includes(privateValue), false);
  }
  assert.equal(typeof json.success, 'boolean');
  if (!json.success) {
    assert.equal(json.data, null);
    assert.equal(json.errors, null);
  }
  return { status: response.status, body: json };
}

function assertEmpty() {
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM files').get().total, 0);
  assert.deepEqual(fs.existsSync(uploadRoot) ? fs.readdirSync(uploadRoot) : [], []);
}

async function uploadPng() {
  const result = await request('POST', '/upload', form());
  assert.equal(result.status, 201);
  return result.body.data.file;
}

for (const [format, extension, mimetype] of [
  ['jpeg', 'jpg', 'image/jpeg'], ['png', 'png', 'image/png'], ['webp', 'webp', 'image/webp'],
]) {
  test(`Upload ${format} succeeds with private metadata and real disk bytes`, async () => {
    const result = await request('POST', '/upload', form(images[format], `original.${extension}`, mimetype));
    assert.equal(result.status, 201);
    const file = result.body.data.file;
    assert.deepEqual(Object.keys(file).sort(), ['created_at', 'filename', 'id', 'mimetype', 'size', 'uploaded_by']);
    assert.match(file.filename, new RegExp(`^[a-f0-9-]{36}\\.${extension}$`));
    assert.equal(file.mimetype, mimetype);
    assert.equal(file.uploaded_by, ownerId);
    assert.equal(file.size, images[format].length);
    assert.deepEqual(fs.readFileSync(path.join(uploadRoot, file.filename)), images[format]);
    assert.deepEqual(fileModel.findById(file.id), file);
  });
}

for (const method of ['POST', 'DELETE']) {
  for (const kind of ['missing', 'invalid', 'expired']) {
    test(`${method} rejects ${kind} JWT with 401 without writing`, async () => {
      const accessToken = kind === 'missing' ? null : kind === 'invalid' ? 'invalid-token'
        : jwt.sign({}, process.env.JWT_SECRET, { subject: String(ownerId), expiresIn: -1 });
      const result = await request(method, method === 'POST' ? '/upload' : '/1',
        method === 'POST' ? form() : null, accessToken);
      assert.equal(result.status, 401);
      assertEmpty();
    });
  }
}

test('Missing file returns 400', async () => {
  assert.equal((await request('POST', '/upload', new FormData())).status, 400);
  assertEmpty();
});

test('Wrong field returns 400 without garbage files', async () => {
  assert.equal((await request('POST', '/upload', form(images.png, 'a.png', 'image/png', 'image'))).status, 400);
  assertEmpty();
});

test('Multiple files return 400 without garbage files', async () => {
  const data = form();
  data.append('file', new Blob([images.png], { type: 'image/png' }), 'second.png');
  assert.equal((await request('POST', '/upload', data)).status, 400);
  assertEmpty();
});

for (const [name, buffer, filename, mimetype] of [
  ['text disguised as PNG', () => Buffer.from('not an image'), 'a.png', 'image/png'],
  ['GIF', () => images.gif, 'a.gif', 'image/gif'],
  ['spoofed MIME', () => images.png, 'a.png', 'image/jpeg'],
  ['spoofed extension', () => images.png, 'a.jpg', 'image/png'],
  ['truncated image', () => images.png.subarray(0, 24), 'a.png', 'image/png'],
  ['signature only', () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'a.png', 'image/png'],
  ['empty file', () => Buffer.alloc(0), 'a.png', 'image/png'],
]) {
  test(`Upload rejects ${name} with 400 and leaves no garbage`, async () => {
    assert.equal((await request('POST', '/upload', form(buffer(), filename, mimetype))).status, 400);
    assertEmpty();
  });
}

test('Over 5 MB returns 413 before decoding and leaves no garbage', async () => {
  assert.equal((await request('POST', '/upload', form(Buffer.alloc(maxFileSize + 1)))).status, 413);
  assertEmpty();
});

test('Duplicate original names receive different random stored filenames', async () => {
  const first = await uploadPng();
  const second = await uploadPng();
  assert.notEqual(first.filename, second.filename);
  assert.equal(fs.readdirSync(uploadRoot).length, 2);
});

test('Client path components never become a stored path', async () => {
  const result = await request('POST', '/upload', form(images.png, '../../outside.png'));
  assert.equal(result.status, 201);
  assert.match(result.body.data.file.filename, /^[a-f0-9-]{36}\.png$/);
  assert.equal(fs.readdirSync(uploadRoot).length, 1);
});

test('Malformed multipart returns generic 400 without garbage files', async () => {
  const response = await fetch(`${baseUrl}/api/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data; boundary=broken',
    },
    body: '--broken\r\ninvalid data',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Multipart khong hop le');
  assertEmpty();
});

test('Delete removes metadata and real disk file', async () => {
  const file = await uploadPng();
  const result = await request('DELETE', `/${file.id}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, { id: file.id });
  assertEmpty();
});

test('Another user cannot delete the upload', async () => {
  const file = await uploadPng();
  assert.equal((await request('DELETE', `/${file.id}`, null, otherToken)).status, 403);
  assert.ok(fileModel.findById(file.id));
  assert.ok(fs.existsSync(path.join(uploadRoot, file.filename)));
});

test('Missing disk file still allows stale metadata to be deleted', async () => {
  const file = await uploadPng();
  fs.unlinkSync(path.join(uploadRoot, file.filename));
  assert.equal((await request('DELETE', `/${file.id}`)).status, 200);
  assertEmpty();
});

test('Unknown file returns 404', async () => {
  assert.equal((await request('DELETE', '/999999')).status, 404);
});

for (const id of ['abc', '0', '-1', '1.5', '9007199254740992', '..%5Coutside.txt']) {
  test(`Invalid file ID ${id} returns 400`, async () => {
    assert.equal((await request('DELETE', `/${id}`)).status, 400);
  });
}

test('Tampered stored filename cannot traverse outside the upload directory', async () => {
  const outside = path.join(temporaryRoot, 'outside.txt');
  fs.writeFileSync(outside, 'keep me');
  try {
    const badFile = fileModel.create({ filename: '../outside.txt', size: 7, mimetype: 'image/png' }, ownerId);
    assert.equal((await request('DELETE', `/${badFile.id}`)).status, 500);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'keep me');
    assert.ok(fileModel.findById(badFile.id));
  } finally {
    fs.unlinkSync(outside);
  }
});

test('Metadata insert failure cleans the new disk file', async (t) => {
  const original = fileModel.create;
  t.mock.method(fileModel, 'create', (...args) => {
    original(...args);
    throw new Error('private metadata failure');
  });
  const result = await request('POST', '/upload', form());
  assert.equal(result.status, 500);
  assert.equal(result.body.message, 'Loi server');
  assertEmpty();
});

test('Metadata delete failure restores the disk file and rolls back SQLite', async (t) => {
  const file = await uploadPng();
  const original = fileModel.remove;
  t.mock.method(fileModel, 'remove', (...args) => {
    original(...args);
    throw new Error('private metadata failure');
  });
  assert.equal((await request('DELETE', `/${file.id}`)).status, 500);
  assert.deepEqual(fileModel.findById(file.id), file);
  assert.deepEqual(fs.readFileSync(path.join(uploadRoot, file.filename)), images.png);
});

test('Disk write failure does not leave metadata or a partial file', async (t) => {
  t.mock.method(fs, 'writeFileSync', () => { throw new Error('private disk failure'); });
  assert.equal((await request('POST', '/upload', form())).status, 500);
  assertEmpty();
});

test('Disk delete failure preserves metadata and file', async (t) => {
  const file = await uploadPng();
  t.mock.method(fs, 'unlinkSync', () => { throw new Error('private disk failure'); });
  assert.equal((await request('DELETE', `/${file.id}`)).status, 500);
  assert.ok(fileModel.findById(file.id));
  assert.deepEqual(fs.readFileSync(path.join(uploadRoot, file.filename)), images.png);
});

test('Uploads are not exposed by a public static route', async () => {
  const file = await uploadPng();
  assert.equal((await fetch(`${baseUrl}/uploads/${file.filename}`)).status, 404);
});

test('Exactly 5 MiB is accepted when the image is valid', async () => {
  // JPEG permits trailing padding; decoding must still succeed and bytes stay bounded.
  const padded = Buffer.concat([images.jpeg, Buffer.alloc(maxFileSize - images.jpeg.length)]);
  const result = await request('POST', '/upload', form(padded, 'padded.jpg', 'image/jpeg'));
  assert.equal(result.status, 201);
  assert.equal(result.body.data.file.size, maxFileSize);
});
