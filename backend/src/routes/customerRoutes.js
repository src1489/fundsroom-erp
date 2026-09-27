const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer } = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getCustomers);
router.post('/', authenticate, authorize('ADMIN', 'SALES'), createCustomer);

module.exports = router;
