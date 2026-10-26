const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const userModel = require('../models/userModel');
const { sendError } = require('../utils/response');

function authenticate(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '');
  let payload;

  try {
    if (!match) {
      return sendError(res, 'Token khong hop le hoac da het han', 401);
    }
    payload = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
    if (!payload || typeof payload.sub !== 'string'
      || !/^\d+$/.test(payload.sub) || !Number.isFinite(payload.exp)) {
      return sendError(res, 'Token khong hop le hoac da het han', 401);
    }
  } catch {
    return sendError(res, 'Token khong hop le hoac da het han', 401);
  }

  const userId = Number(payload.sub);
  const user = Number.isSafeInteger(userId) ? userModel.findById(userId) : null;
  if (!user) {
    return sendError(res, 'Token khong hop le hoac da het han', 401);
  }

  req.user = user;
  return next();
}

module.exports = authenticate;
