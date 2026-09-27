const express = require('express');
const router = express.Router();
const { getProducts, createProduct } = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getProducts);
router.post('/', authenticate, authorize('ADMIN'), createProduct);

module.exports = router;
