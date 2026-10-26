const database = require('../config/database');

const selectNews = `
  SELECT n.id, n.title, n.content, n.author_id, u.username AS author_username,
         n.created_at, n.updated_at
  FROM news n
  JOIN users u ON u.id = n.author_id
`;

function toNews(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    author: { id: row.author_id, username: row.author_username },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function findAll(limit, offset) {
  return database.prepare(`${selectNews}
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset).map(toNews);
}

function count() {
  return database.prepare('SELECT COUNT(*) AS total FROM news').get().total;
}

function findById(id) {
  const row = database.prepare(`${selectNews} WHERE n.id = ?`).get(id);
  return row ? toNews(row) : null;
}

module.exports = { findAll, count, findById };
