const bcrypt = require('bcryptjs');
const { sendError } = require('../utils/response');

function validateAuth(mode) {
  return (req, res, next) => {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';

    if (!email || !password || (mode === 'register' && !username)) {
      return sendError(res, 'Vui long cung cap day du thong tin', 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 'Email khong hop le', 400);
    }

    if (mode === 'register' && (password.length < 8 || bcrypt.truncates(password))) {
      return sendError(res, 'Mat khau can it nhat 8 ky tu va khong qua 72 byte UTF-8', 400);
    }

    req.authInput = { username, email, password };
    return next();
  };
}

module.exports = validateAuth;
