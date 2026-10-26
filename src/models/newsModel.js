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

function create({ title, content }, authorId) {
  const result = database.prepare(
    'INSERT INTO news (title, content, author_id) VALUES (?, ?, ?)',
  ).run(title, content, authorId);

  return findById(result.lastInsertRowid);
}

function exists(id) {
  return Boolean(database.prepare('SELECT id FROM news WHERE id = ?').get(id));
}

// The write lock covers the owner condition, existence check and response read.
const updateOwned = database.transaction((id, authorId, { title, content }) => {
  const result = database.prepare(`
    UPDATE news SET title = ?, content = ?,
      updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE id = ? AND author_id = ?
  `).run(title, content, id, authorId);

  if (result.changes === 0) {
    return { news: null, exists: exists(id) };
  }

  return { news: findById(id), exists: true };
});

const deleteOwned = database.transaction((id, authorId) => {
  const result = database.prepare(
    'DELETE FROM news WHERE id = ? AND author_id = ?',
  ).run(id, authorId);

  return { deleted: result.changes > 0, exists: result.changes > 0 || exists(id) };
});

function update(id, authorId, input) {
  return updateOwned.immediate(id, authorId, input);
}

function remove(id, authorId) {
  return deleteOwned.immediate(id, authorId);
}

module.exports = { findAll, count, findById, create, update, remove };
