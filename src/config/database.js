const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { dbPath } = require('./env');

const filename = dbPath === ':memory:' ? dbPath : path.resolve(__dirname, '../..', dbPath);

if (filename !== ':memory:') {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
}

const database = new Database(filename);

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = database;
