const express = require('express');
const router = express.Router();
const { getInventory, updateInventory } = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getInventory);
router.put('/', authenticate, authorize('ADMIN'), updateInventory);

module.exports = router;
