/**
 * Business Calculation Utility for Quotations
 * Ensures backend-enforced monetary calculations and prevents client-side tampering.
 */

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function calculateItemAmounts(item) {
  const quantity = parseInt(item.quantity, 10);
  const unitPrice = parseFloat(item.unit_price);
  const discountPercentage = parseFloat(item.discount_percentage || 0);
  const gstPercentage = parseFloat(item.gst_percentage !== undefined ? item.gst_percentage : 18);

  if (isNaN(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive integer');
  }
  if (isNaN(unitPrice) || unitPrice < 0) {
    throw new Error('Unit price must be non-negative');
  }
  if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }
  if (isNaN(gstPercentage) || gstPercentage < 0) {
    throw new Error('GST percentage must be non-negative');
  }

  // Base Amount = Quantity × Unit Price
  const baseAmount = round2(quantity * unitPrice);

  // Discount Amount = Base Amount × (Discount % / 100)
  const discountAmount = round2(baseAmount * (discountPercentage / 100));

  // Taxable Amount = Base Amount - Discount Amount
  const taxableAmount = round2(baseAmount - discountAmount);

  // GST Amount = Taxable Amount × (GST % / 100)
  const gstAmount = round2(taxableAmount * (gstPercentage / 100));

  // Line Amount = Taxable Amount + GST Amount
  const lineAmount = round2(taxableAmount + gstAmount);

  return {
    quantity,
    unit_price: round2(unitPrice),
    discount_percentage: round2(discountPercentage),
    gst_percentage: round2(gstPercentage),
    base_amount: baseAmount,
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    line_amount: lineAmount,
  };
}

function calculateQuotationTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Quotation must contain at least one item');
  }

  const calculatedItems = items.map((item) => {
    const calculated = calculateItemAmounts(item);
    return {
      product_id: item.product_id,
      ...calculated,
    };
  });

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of calculatedItems) {
    subtotal += item.base_amount;
    totalDiscount += item.discount_amount;
    totalTax += item.gst_amount;
    grandTotal += item.line_amount;
  }

  return {
    items: calculatedItems,
    subtotal: round2(subtotal),
    total_discount: round2(totalDiscount),
    total_tax: round2(totalTax),
    grand_total: round2(grandTotal),
  };
}

module.exports = {
  round2,
  calculateItemAmounts,
  calculateQuotationTotals,
};
