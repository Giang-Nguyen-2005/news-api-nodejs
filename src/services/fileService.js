const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const database = require('../config/database');
const { uploadRoot, maxFileSize, maxImagePixels } = require('../config/files');
const fileModel = require('../models/fileModel');
const httpError = require('../utils/httpError');

const formats = new Map([
  ['jpeg', { extension: 'jpg', extensions: ['.jpg', '.jpeg'], mimetype: 'image/jpeg' }],
  ['png', { extension: 'png', extensions: ['.png'], mimetype: 'image/png' }],
  ['webp', { extension: 'webp', extensions: ['.webp'], mimetype: 'image/webp' }],
]);

function safePath(filename) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(filename)) {
    throw new Error('Invalid stored filename');
  }
  fs.mkdirSync(uploadRoot, { recursive: true });
  const root = fs.realpathSync(uploadRoot);
  const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (fs.lstatSync(uploadRoot).isSymbolicLink() || normalize(root) !== normalize(uploadRoot)) {
    throw new Error('Upload directory must not contain symbolic links');
  }
  const target = path.resolve(root, filename);
  if (path.dirname(target) !== root) throw new Error('Invalid upload path');
  return target;
}

async function validateImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw httpError(400, 'File anh khong hop le');
  }
  if (file.buffer.length > maxFileSize) throw httpError(413, 'File vuot qua 5 MB');

  let format;
  try {
    const image = sharp(file.buffer, {
      failOn: 'warning', limitInputPixels: maxImagePixels, animated: true,
    });
    const metadata = await image.metadata();
    format = formats.get(metadata.format);
    if (!format) throw new Error('Unsupported image format');
    // metadata alone does not decode pixels; stats forces a full decode.
    await image.stats();
  } catch {
    throw httpError(400, 'Chi chap nhan anh JPG, PNG, WEBP hop le (toi da 16 megapixel)');
  }

  if (file.mimetype !== format.mimetype
    || !format.extensions.includes(path.extname(file.originalname).toLowerCase())) {
    throw httpError(400, 'MIME hoac extension khong khop noi dung anh');
  }
  return format;
}

async function upload(file, userId) {
  const format = await validateImage(file);
  const filename = `${randomUUID()}.${format.extension}`;
  const target = safePath(filename);
  let created = false;

  try {
    return database.transaction(() => {
      const descriptor = fs.openSync(target, 'wx');
      created = true;
      try {
        fs.writeFileSync(descriptor, file.buffer);
      } finally {
        fs.closeSync(descriptor);
      }
      return fileModel.create({ filename, size: file.buffer.length, mimetype: format.mimetype }, userId);
    }).immediate();
  } catch (error) {
    // Also runs if INSERT or COMMIT fails. Never remove an existing collision.
    if (created) fs.unlinkSync(target);
    throw error;
  }
}

function remove(rawId, userId) {
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)
    || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) {
    throw httpError(400, 'ID khong hop le');
  }
  const id = Number(rawId);
  let deletedPath;
  let backup;

  try {
    return database.transaction(() => {
      const file = fileModel.findById(id);
      if (!file) throw httpError(404, 'Khong tim thay file');
      if (file.uploaded_by !== userId) throw httpError(403, 'Ban khong co quyen xoa file nay');
      const target = safePath(file.filename);
      try {
        const stat = fs.lstatSync(target);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxFileSize) {
          throw new Error('Invalid stored file');
        }
        backup = fs.readFileSync(target);
        fs.unlinkSync(target);
        deletedPath = target;
      } catch (error) {
        // A missing disk file must not prevent removing stale metadata.
        if (error.code !== 'ENOENT') throw error;
      }
      if (fileModel.remove(id, userId) !== 1) throw new Error('File metadata changed');
      return { id };
    }).immediate();
  } catch (error) {
    // Restore bytes if metadata deletion or transaction commit fails.
    if (deletedPath) fs.writeFileSync(deletedPath, backup, { flag: 'wx' });
    throw error;
  }
}

module.exports = { upload, remove };
