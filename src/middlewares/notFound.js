const { sendError } = require('../utils/response');

function notFound(req, res) {
  return sendError(res, 'Khong tim thay API', 404);
}

module.exports = notFound;
