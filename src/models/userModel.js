const database = require('../config/database');

function findByEmail(email) {
  return database.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findById(id) {
  return database.prepare(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
  ).get(id);
}

function exists(username, email) {
  return Boolean(database.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?',
  ).get(username, email));
}

function create({ username, email, passwordHash }) {
  const result = database.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
  ).run(username, email, passwordHash);

  return findById(result.lastInsertRowid);
}

module.exports = { findByEmail, findById, exists, create };
