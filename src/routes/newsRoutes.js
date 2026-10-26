const express = require('express');
const controller = require('../controllers/newsController');
const authenticate = require('../middlewares/authenticate');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.detail);
router.post('/', authenticate, controller.create);
router.put('/:id', authenticate, controller.update);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
