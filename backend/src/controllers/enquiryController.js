const db = require('../config/db');

async function getEnquiries(req, res) {
  try {
    const query = `
      SELECT 
        e.id,
        e.enquiry_number,
        e.customer_id,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        e.enquiry_date,
        e.required_date,
        e.notes,
        e.status,
        e.created_at,
        u.name AS created_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', ei.id,
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'category', p.category,
              'unit', p.unit,
              'base_price', p.base_price,
              'quantity', ei.quantity,
              'physical_quantity', i.physical_quantity,
              'reserved_quantity', i.reserved_quantity,
              'available_quantity', (i.physical_quantity - i.reserved_quantity)
            )
          ) FILTER (WHERE ei.id IS NOT NULL),
          '[]'
        ) AS items
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN enquiry_items ei ON e.id = ei.enquiry_id
      LEFT JOIN products p ON ei.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY e.id, c.company_name, c.contact_person, c.mobile, c.email, c.city, u.name
      ORDER BY e.id DESC
    `;
    const result = await db.query(query);
    return res.json({
      success: true,
      enquiries: result.rows,
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve enquiries' });
  }
}

async function getEnquiryById(req, res) {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        e.id,
        e.enquiry_number,
        e.customer_id,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        e.enquiry_date,
        e.required_date,
        e.notes,
        e.status,
        e.created_at,
        u.name AS created_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', ei.id,
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'unit', p.unit,
              'base_price', p.base_price,
              'quantity', ei.quantity,
              'available_quantity', (i.physical_quantity - i.reserved_quantity)
            )
          ) FILTER (WHERE ei.id IS NOT NULL),
          '[]'
        ) AS items
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN enquiry_items ei ON e.id = ei.enquiry_id
      LEFT JOIN products p ON ei.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE e.id = $1
      GROUP BY e.id, c.company_name, c.contact_person, c.mobile, c.email, c.city, u.name
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    return res.json({
      success: true,
      enquiry: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching enquiry by ID:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve enquiry' });
  }
}

async function createEnquiry(req, res) {
  const { customer_id, required_date, notes, items } = req.body;

  if (!customer_id || !required_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Customer, required date, and at least one product item are required',
    });
  }

  // Validate item quantities
  for (const item of items) {
    if (!item.product_id || !item.quantity || parseInt(item.quantity, 10) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Each item must have a valid product_id and quantity greater than 0',
      });
    }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Generate unique sequential Enquiry Number
    const countRes = await client.query('SELECT COUNT(*) FROM enquiries');
    const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
    const year = new Date().getFullYear();
    const enquiryNumber = `ENQ-${year}-${String(nextSeq).padStart(4, '0')}`;

    const enqRes = await client.query(
      `INSERT INTO enquiries (enquiry_number, customer_id, enquiry_date, required_date, notes, status, created_by)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, 'NEW', $5)
       RETURNING *`,
      [enquiryNumber, customer_id, required_date, notes || '', req.user.id]
    );
    const enquiry = enqRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO enquiry_items (enquiry_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [enquiry.id, item.product_id, parseInt(item.quantity, 10)]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Enquiry created successfully',
      enquiry: {
        ...enquiry,
        items,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating enquiry:', error);
    return res.status(500).json({ success: false, message: 'Failed to create enquiry' });
  } finally {
    client.release();
  }
}

async function updateEnquiryStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['NEW', 'QUOTED', 'WON', 'LOST'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
    });
  }

  try {
    const result = await db.query(
      'UPDATE enquiries SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    return res.json({
      success: true,
      message: `Enquiry status updated to ${status}`,
      enquiry: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating enquiry status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update enquiry status' });
  }
}

module.exports = {
  getEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiryStatus,
};
