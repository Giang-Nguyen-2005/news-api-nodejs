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

  const total = newsModel.count();
  return {
    news: newsModel.findAll(limit, offset),
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

module.exports = { list, detail };
