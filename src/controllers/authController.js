const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

async function register(req, res) {
  const user = await authService.register(req.authInput);
  return sendSuccess(res, 'Dang ky thanh cong', { user }, 201);
}

async function login(req, res) {
  const data = await authService.login(req.authInput);
  return sendSuccess(res, 'Dang nhap thanh cong', data);
}

function me(req, res) {
  return sendSuccess(res, 'Lay thong tin tai khoan thanh cong', { user: req.user });
}

module.exports = { register, login, me };
