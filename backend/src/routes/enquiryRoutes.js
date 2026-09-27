const express = require('express');
const router = express.Router();
const {
  getEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiryStatus,
} = require('../controllers/enquiryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getEnquiries);
router.get('/:id', authenticate, getEnquiryById);
router.post('/', authenticate, authorize('ADMIN', 'SALES'), createEnquiry);
router.patch('/:id/status', authenticate, authorize('ADMIN', 'SALES'), updateEnquiryStatus);

module.exports = router;
