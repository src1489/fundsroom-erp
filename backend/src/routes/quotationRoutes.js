const express = require('express');
const router = express.Router();
const {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  convertToSalesOrder,
} = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getQuotations);
router.get('/:id', authenticate, getQuotationById);
router.post('/', authenticate, authorize('ADMIN', 'SALES'), createQuotation);
router.patch('/:id/status', authenticate, authorize('ADMIN', 'SALES'), updateQuotationStatus);
router.post('/:id/convert', authenticate, authorize('ADMIN', 'SALES'), convertToSalesOrder);

module.exports = router;
