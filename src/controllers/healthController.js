const { sendSuccess } = require('../utils/response');

function getHealth(req, res) {
  return sendSuccess(res, 'Server is running', { status: 'ok' });
}

module.exports = { getHealth };
