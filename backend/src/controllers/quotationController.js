const db = require('../config/db');
const { calculateQuotationTotals } = require('../utils/calculator');

async function getQuotations(req, res) {
  try {
    const query = `
      SELECT 
        q.id,
        q.quotation_number,
        q.enquiry_id,
        e.enquiry_number,
        q.customer_id,
        c.company_name,
        c.contact_person,
        c.email,
        c.mobile,
        c.city,
        q.subtotal,
        q.total_discount,
        q.total_tax,
        q.grand_total,
        q.valid_until,
        q.status,
        q.created_at,
        u.name AS created_by_name,
        so.id AS sales_order_id,
        so.order_number AS sales_order_number,
        so.status AS sales_order_status,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', qi.id,
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'unit', p.unit,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price,
              'discount_percentage', qi.discount_percentage,
              'gst_percentage', qi.gst_percentage,
              'base_amount', qi.base_amount,
              'discount_amount', qi.discount_amount,
              'taxable_amount', qi.taxable_amount,
              'gst_amount', qi.gst_amount,
              'line_amount', qi.line_amount,
              'available_quantity', (i.physical_quantity - i.reserved_quantity)
            )
          ) FILTER (WHERE qi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      JOIN enquiries e ON q.enquiry_id = e.id
      JOIN customers c ON q.customer_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN sales_orders so ON q.id = so.quotation_id
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN products p ON qi.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY q.id, e.enquiry_number, c.company_name, c.contact_person, c.email, c.mobile, c.city, u.name, so.id, so.order_number, so.status
      ORDER BY q.id DESC
    `;
    const result = await db.query(query);
    return res.json({
      success: true,
      quotations: result.rows,
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve quotations' });
  }
}

async function getQuotationById(req, res) {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        q.id,
        q.quotation_number,
        q.enquiry_id,
        e.enquiry_number,
        q.customer_id,
        c.company_name,
        c.contact_person,
        c.email,
        c.mobile,
        c.city,
        q.subtotal,
        q.total_discount,
        q.total_tax,
        q.grand_total,
        q.valid_until,
        q.status,
        q.created_at,
        u.name AS created_by_name,
        so.id AS sales_order_id,
        so.order_number AS sales_order_number,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', qi.id,
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'unit', p.unit,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price,
              'discount_percentage', qi.discount_percentage,
              'gst_percentage', qi.gst_percentage,
              'base_amount', qi.base_amount,
              'discount_amount', qi.discount_amount,
              'taxable_amount', qi.taxable_amount,
              'gst_amount', qi.gst_amount,
              'line_amount', qi.line_amount,
              'available_quantity', (i.physical_quantity - i.reserved_quantity)
            )
          ) FILTER (WHERE qi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      JOIN enquiries e ON q.enquiry_id = e.id
      JOIN customers c ON q.customer_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN sales_orders so ON q.id = so.quotation_id
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN products p ON qi.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE q.id = $1
      GROUP BY q.id, e.enquiry_number, c.company_name, c.contact_person, c.email, c.mobile, c.city, u.name, so.id, so.order_number
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    return res.json({
      success: true,
      quotation: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching quotation by ID:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve quotation' });
  }
}

async function createQuotation(req, res) {
  const { enquiry_id, valid_until, items } = req.body;

  if (!enquiry_id || !valid_until || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Enquiry ID, valid until date, and at least one item are required',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Fetch Enquiry and Customer Details
    const enqRes = await client.query(
      'SELECT id, customer_id, status FROM enquiries WHERE id = $1',
      [enquiry_id]
    );

    if (enqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Referenced Enquiry does not exist' });
    }

    const enquiry = enqRes.rows[0];

    // 2. BACKEND CALCULATION & VALIDATION (Mandatory Requirement)
    // Do not blindly trust frontend totals!
    const calculation = calculateQuotationTotals(items);

    // 3. Generate unique sequential Quotation Number
    const countRes = await client.query('SELECT COUNT(*) FROM quotations');
    const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
    const year = new Date().getFullYear();
    const quotationNumber = `QT-${year}-${String(nextSeq).padStart(4, '0')}`;

    // 4. Insert Quotation Header
    const quotRes = await client.query(
      `INSERT INTO quotations (
         quotation_number, enquiry_id, customer_id,
         subtotal, total_discount, total_tax, grand_total,
         valid_until, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9)
       RETURNING *`,
      [
        quotationNumber,
        enquiry.id,
        enquiry.customer_id,
        calculation.subtotal,
        calculation.total_discount,
        calculation.total_tax,
        calculation.grand_total,
        valid_until,
        req.user.id,
      ]
    );
    const quotation = quotRes.rows[0];

    // 5. Insert Quotation Items with backend-calculated amounts
    for (const item of calculation.items) {
      await client.query(
        `INSERT INTO quotation_items (
           quotation_id, product_id, quantity, unit_price,
           discount_percentage, gst_percentage, base_amount,
           discount_amount, taxable_amount, gst_amount, line_amount
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          quotation.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.discount_percentage,
          item.gst_percentage,
          item.base_amount,
          item.discount_amount,
          item.taxable_amount,
          item.gst_amount,
          item.line_amount,
        ]
      );
    }

    // 6. Update Enquiry status to 'QUOTED'
    await client.query('UPDATE enquiries SET status = $1 WHERE id = $2', ['QUOTED', enquiry.id]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Quotation created successfully with backend-validated calculations',
      quotation: {
        ...quotation,
        items: calculation.items,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quotation:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create quotation',
    });
  } finally {
    client.release();
  }
}

async function updateQuotationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const curRes = await client.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [id]);
    if (curRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const quotation = curRes.rows[0];

    // If quotation is already converted to a Sales Order, status change might be restricted
    const soRes = await client.query('SELECT id FROM sales_orders WHERE quotation_id = $1', [id]);
    if (soRes.rows.length > 0 && status === 'REJECTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot reject a quotation that has already been converted into a Sales Order',
      });
    }

    const updateRes = await client.query(
      'UPDATE quotations SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    // Update parent enquiry status if quotation is accepted or rejected
    if (status === 'ACCEPTED') {
      await client.query('UPDATE enquiries SET status = $1 WHERE id = $2', ['WON', quotation.enquiry_id]);
    } else if (status === 'REJECTED') {
      await client.query('UPDATE enquiries SET status = $1 WHERE id = $2', ['LOST', quotation.enquiry_id]);
    }

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: `Quotation status updated to ${status}`,
      quotation: updateRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating quotation status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update quotation status' });
  } finally {
    client.release();
  }
}

/**
 * Requirement 5: Convert ACCEPTED quotation into Sales Order
 * - DRAFT quotation cannot create an order.
 * - REJECTED quotation cannot create an order.
 * - One quotation should not accidentally generate multiple Sales Orders.
 * - Traceable: Customer -> Enquiry -> Quotation -> Sales Order
 */
async function convertToSalesOrder(req, res) {
  const { id } = req.params;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock quotation row
    const quotRes = await client.query(
      `SELECT q.*, c.company_name 
       FROM quotations q
       JOIN customers c ON q.customer_id = c.id
       WHERE q.id = $1 FOR UPDATE`,
      [id]
    );

    if (quotRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    const quotation = quotRes.rows[0];

    // Rule 1: DRAFT quotation cannot create an order
    if (quotation.status === 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot convert DRAFT quotation to Sales Order. Quotation must be ACCEPTED first.',
      });
    }

    // Rule 2: REJECTED quotation cannot create an order
    if (quotation.status === 'REJECTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot convert REJECTED quotation to Sales Order.',
      });
    }

    // Only ACCEPTED quotations can create an order
    if (quotation.status !== 'ACCEPTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Quotation must be in ACCEPTED status (Current status: ${quotation.status})`,
      });
    }

    // Rule 3: One quotation should not generate multiple Sales Orders
    const existingOrderRes = await client.query(
      'SELECT id, order_number FROM sales_orders WHERE quotation_id = $1',
      [id]
    );

    if (existingOrderRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Sales Order (${existingOrderRes.rows[0].order_number}) has already been generated for this Quotation. Duplicate orders are prevented.`,
      });
    }

    // Fetch quotation items
    const itemsRes = await client.query(
      'SELECT product_id, quantity, unit_price, line_amount FROM quotation_items WHERE quotation_id = $1',
      [id]
    );

    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Quotation has no items' });
    }

    // Generate unique sequential Order Number
    const countRes = await client.query('SELECT COUNT(*) FROM sales_orders');
    const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
    const year = new Date().getFullYear();
    const orderNumber = `SO-${year}-${String(nextSeq).padStart(4, '0')}`;

    // Create Sales Order (Status: PENDING)
    const orderRes = await client.query(
      `INSERT INTO sales_orders (
         order_number, quotation_id, customer_id,
         order_date, total_amount, status, created_by
       ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'PENDING', $5)
       RETURNING *`,
      [orderNumber, quotation.id, quotation.customer_id, quotation.grand_total, req.user.id]
    );
    const order = orderRes.rows[0];

    // Insert Sales Order Items
    for (const item of itemsRes.rows) {
      await client.query(
        `INSERT INTO sales_order_items (
           sales_order_id, product_id, quantity, unit_price, line_amount
         ) VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.product_id, item.quantity, item.unit_price, item.line_amount]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Sales Order generated successfully from accepted quotation',
      sales_order: {
        ...order,
        items: itemsRes.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error converting quotation to sales order:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'A Sales Order already exists for this quotation (Unique Constraint Enforced).',
      });
    }
    return res.status(500).json({ success: false, message: 'Failed to convert quotation to Sales Order' });
  } finally {
    client.release();
  }
}

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  convertToSalesOrder,
};
