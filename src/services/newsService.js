const newsModel = require('../models/newsModel');
const httpError = require('../utils/httpError');

function positiveInteger(value, name, defaultValue, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined && defaultValue !== undefined) {
    return defaultValue;
  }

  const number = Number(value);
  if (typeof value !== 'string' || !/^\d+$/.test(value)
    || !Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw httpError(400, `${name} khong hop le`);
  }

  return number;
}

function list(query) {
  const page = positiveInteger(query.page, 'page', 1);
  const limit = positiveInteger(query.limit, 'limit', 10, 100);
  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    throw httpError(400, 'page khong hop le');
  }

  const rawSearch = query.search === undefined ? '' : query.search;
  if (typeof rawSearch !== 'string' || rawSearch.trim().length > 200 || rawSearch.includes('\0')) {
    throw httpError(400, 'search khong hop le');
  }
  const search = rawSearch.trim();
  const sortBy = query.sortBy === undefined ? 'created_at' : query.sortBy;
  const order = query.order === undefined ? 'desc' : query.order;
  if (!['created_at', 'updated_at', 'title'].includes(sortBy)) {
    throw httpError(400, 'sortBy khong hop le');
  }
  if (!['asc', 'desc'].includes(order)) {
    throw httpError(400, 'order khong hop le');
  }

  const total = newsModel.count(search);
  return {
    news: newsModel.findAll(limit, offset, { search, sortBy, order }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function detail(rawId) {
  const id = positiveInteger(rawId, 'ID');
  const news = newsModel.findById(id);

  if (!news) {
    throw httpError(404, 'Khong tim thay tin tuc');
  }

  return news;
}

function validateInput(body) {
  if (!body || Array.isArray(body) || typeof body.title !== 'string'
    || typeof body.content !== 'string' || !body.title.trim() || !body.content.trim()) {
    throw httpError(400, 'Title va content phai la chuoi khong rong');
  }

  return { title: body.title.trim(), content: body.content.trim() };
}

function create(body, authorId) {
  return newsModel.create(validateInput(body), authorId);
}

function update(rawId, body, authorId) {
  const id = positiveInteger(rawId, 'ID');
  const result = newsModel.update(id, authorId, validateInput(body));

  if (!result.exists) {
    throw httpError(404, 'Khong tim thay tin tuc');
  }
  if (!result.news) {
    throw httpError(403, 'Ban khong co quyen sua tin tuc nay');
  }

  return result.news;
}

function remove(rawId, authorId) {
  const id = positiveInteger(rawId, 'ID');
  const result = newsModel.remove(id, authorId);

  if (!result.exists) {
    throw httpError(404, 'Khong tim thay tin tuc');
  }
  if (!result.deleted) {
    throw httpError(403, 'Ban khong co quyen xoa tin tuc nay');
  }

  return { id };
}

module.exports = { list, detail, create, update, remove };
