const express = require('express');
const router = express.Router();
const { getDispatches } = require('../controllers/dispatchController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getDispatches);

module.exports = router;
