const path = require('node:path');
const { uploadDir } = require('./env');

module.exports = {
  uploadRoot: path.resolve(__dirname, '../..', uploadDir),
  maxFileSize: 5 * 1024 * 1024,
  maxImagePixels: 16 * 1024 * 1024,
};
