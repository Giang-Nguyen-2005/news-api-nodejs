const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const httpError = require('../utils/httpError');

const invalidCredentials = () => httpError(401, 'Email hoac mat khau khong dung');

async function register({ username, email, password }) {
  if (userModel.exists(username, email)) {
    throw httpError(409, 'Username hoac email da ton tai');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    return userModel.create({ username, email, passwordHash });
  } catch (error) {
    // UNIQUE also protects simultaneous registrations after the initial check.
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw httpError(409, 'Username hoac email da ton tai');
    }
    throw error;
  }
}

async function login({ email, password }) {
  const account = userModel.findByEmail(email);

  if (!account || bcrypt.truncates(password) || !await bcrypt.compare(password, account.password_hash)) {
    throw invalidCredentials();
  }

  const accessToken = jwt.sign({}, jwtSecret, {
    subject: String(account.id),
    algorithm: 'HS256',
    expiresIn: jwtExpiresIn,
  });

  return {
    user: userModel.findById(account.id),
    accessToken,
    tokenType: 'Bearer',
    expiresIn: jwtExpiresIn,
  };
}

module.exports = { register, login };
