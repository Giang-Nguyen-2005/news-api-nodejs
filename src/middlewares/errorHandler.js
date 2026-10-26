const { nodeEnv } = require('../config/env');
const { sendError } = require('../utils/response');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number.isInteger(error.status) && error.status >= 400
    && error.status <= 599 ? error.status : 500;

  if (statusCode >= 500) {
    if (nodeEnv !== 'test') {
      console.error(error);
    }

    return sendError(res, 'Loi server', statusCode);
  }

  if (error.type === 'entity.parse.failed') {
    return sendError(res, 'JSON khong hop le', 400);
  }

  return sendError(res, error.message || 'Yeu cau khong hop le', statusCode);
}

module.exports = errorHandler;
