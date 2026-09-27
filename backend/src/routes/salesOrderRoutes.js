const express = require('express');
const router = express.Router();
const {
  getSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
  cancelSalesOrder,
} = require('../controllers/salesOrderController');
const { createDispatch } = require('../controllers/dispatchController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getSalesOrders);
router.get('/:id', authenticate, getSalesOrderById);
// Admin only actions
router.post('/:id/confirm', authenticate, authorize('ADMIN'), confirmSalesOrder);
router.post('/:id/dispatch', authenticate, authorize('ADMIN'), createDispatch);
router.post('/:id/cancel', authenticate, authorize('ADMIN'), cancelSalesOrder);

module.exports = router;
