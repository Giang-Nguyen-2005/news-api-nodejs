const express = require('express');
const controller = require('../controllers/newsController');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.detail);

module.exports = router;
