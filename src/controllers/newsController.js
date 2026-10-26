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

module.exports = { list, detail };
