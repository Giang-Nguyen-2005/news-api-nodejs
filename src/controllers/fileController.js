const fileService = require('../services/fileService');
const { sendSuccess } = require('../utils/response');

async function upload(req, res) {
  const file = await fileService.upload(req.file, req.user.id);
  return sendSuccess(res, 'Upload file thanh cong', { file }, 201);
}

function remove(req, res) {
  return sendSuccess(res, 'Xoa file thanh cong', fileService.remove(req.params.id, req.user.id));
}

module.exports = { upload, remove };
