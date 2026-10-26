const express = require('express');
const controller = require('../controllers/authController');
const validateAuth = require('../middlewares/validateAuth');
const authenticate = require('../middlewares/authenticate');

const router = express.Router();

router.post('/register', validateAuth('register'), controller.register);
router.post('/login', validateAuth('login'), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
