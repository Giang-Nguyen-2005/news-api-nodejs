const express = require('express');
const authenticate = require('../middlewares/authenticate');
const upload = require('../middlewares/upload');
const controller = require('../controllers/fileController');

const router = express.Router();

router.post('/upload', authenticate, upload, controller.upload);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
