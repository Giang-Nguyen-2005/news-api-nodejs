const newsService = require('../services/newsService');
const { sendSuccess } = require('../utils/response');

function list(req, res) {
  return sendSuccess(res, 'Lay danh sach tin tuc thanh cong', newsService.list(req.query));
}

function detail(req, res) {
  return sendSuccess(res, 'Lay chi tiet tin tuc thanh cong', {
    news: newsService.detail(req.params.id),
  });
}

function create(req, res) {
  return sendSuccess(res, 'Them tin tuc thanh cong', {
    news: newsService.create(req.body, req.user.id),
  }, 201);
}

function update(req, res) {
  return sendSuccess(res, 'Sua tin tuc thanh cong', {
    news: newsService.update(req.params.id, req.body, req.user.id),
  });
}

function remove(req, res) {
  return sendSuccess(res, 'Xoa tin tuc thanh cong', newsService.remove(req.params.id, req.user.id));
}

module.exports = { list, detail, create, update, remove };
