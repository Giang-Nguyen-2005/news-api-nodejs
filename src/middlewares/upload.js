const multer = require('multer');
const { maxFileSize } = require('../config/files');
const httpError = require('../utils/httpError');

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1, fields: 0, parts: 1 },
}).single('file');

function upload(req, res, next) {
  receive(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const tooLarge = error.code === 'LIMIT_FILE_SIZE';
        return next(httpError(tooLarge ? 413 : 400,
          tooLarge ? 'File vuot qua 5 MB' : 'Chi chap nhan mot file voi field file'));
      }
      // Multipart parser messages can contain implementation details.
      return next(httpError(400, 'Multipart khong hop le'));
    }
    if (!req.file) return next(httpError(400, 'Vui long gui file'));
    return next();
  });
}

module.exports = upload;
