require('dotenv').config({ quiet: true });

const port = Number(process.env.PORT || 3000);
const nodeEnv = process.env.NODE_ENV || 'development';
const dbPath = process.env.DB_PATH || './data/news.db';
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = Number(process.env.JWT_EXPIRES_IN || 3600);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test or production');
}

if (typeof jwtSecret !== 'string' || jwtSecret.trim().length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

if (!Number.isSafeInteger(jwtExpiresIn) || jwtExpiresIn < 1) {
  throw new Error('JWT_EXPIRES_IN must be a positive integer in seconds');
}

module.exports = { port, nodeEnv, dbPath, jwtSecret, jwtExpiresIn };
