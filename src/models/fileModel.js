const database = require('../config/database');

function findById(id) {
  return database.prepare(
    'SELECT id, filename, size, mimetype, uploaded_by, created_at FROM files WHERE id = ?',
  ).get(id);
}

function create({ filename, size, mimetype }, userId) {
  const result = database.prepare(
    'INSERT INTO files (filename, size, mimetype, uploaded_by) VALUES (?, ?, ?, ?)',
  ).run(filename, size, mimetype, userId);
  return findById(result.lastInsertRowid);
}

function remove(id, userId) {
  return database.prepare('DELETE FROM files WHERE id = ? AND uploaded_by = ?')
    .run(id, userId).changes;
}

module.exports = { findById, create, remove };
