const db = require('../config/db');

async function getSalesOrders(req, res) {
  try {
    const query = `
      SELECT 
        so.id,
        so.order_number,
        so.quotation_id,
        q.quotation_number,
        q.enquiry_id,
        e.enquiry_number,
        so.customer_id,
        c.company_name,
        c.contact_person,
        c.email,
        c.mobile,
        c.city,
        so.order_date,
        so.total_amount,
        so.status,
        so.confirmed_at,
        u_conf.name AS confirmed_by_name,
        so.created_at,
        u_cre.name AS created_by_name,
        d.id AS dispatch_id,
        d.dispatch_number,
        d.vehicle_number,
        d.driver_name,
        d.dispatch_date,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', soi.id,
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'unit', p.unit,
              'quantity', soi.quantity,
              'unit_price', soi.unit_price,
              'line_amount', soi.line_amount,
              'physical_quantity', i.physical_quantity,
              'reserved_quantity', i.reserved_quantity,
              'available_quantity', (i.physical_quantity - i.reserved_quantity)
            )
          ) FILTER (WHERE soi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM sales_orders so
      JOIN quotations q ON so.quotation_id = q.id
      JOIN enquiries e ON q.enquiry_id = e.id
      JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u_cre ON so.created_by = u_cre.id
      LEFT JOIN users u_conf ON so.confirmed_by = u_conf.id
      LEFT JOIN dispatches d ON so.id = d.sales_order_id
      LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY so.id, q.quotation_number, q.enquiry_id, e.enquiry_number, c.company_name, c.contact_person, c.email, c.mobile, c.city, u_cre.name, u_conf.name, d.id, d.dispatch_number, d.vehicle_number, d.driver_name, d.dispatch_date
      ORDER BY so.id DESC
    `;
    const result = await db.query(query);
    return res.json({
      success: true,
      sales_orders: result.rows,
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sales orders' });
  }
}

async function getSalesOrderById(req, res) {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        so.id,
        so.order_number,
        so.quotation_id,
        q.quotation_number,
        q.enquiry_id,
        e.enquiry_number,
        so.customer_id,
        c.company_name,
        c.contact_person,
        c.email,
        c.mobile,
        c.city,
        so.order_date,
        so.total_amount,
        so.status,
        so.confirmed_at,
        u_conf.name AS confirmed_by_name,
        so.created_at,
        u_cre.name AS created_by_name,
        d.id AS dispatch_id,
        d.dispatch_number,
        d.vehicle_number,
        d.driver_name,
        d.dispatch_date,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', soi.id,
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'unit', p.unit,
              'quantity', soi.quantity,
              'unit_price', soi.unit_price,
              'line_amount', soi.line_amount,
              'physical_quantity', i.physical_quantity,
              'reserved_quantity', i.reserved_quantity,
              'available_quantity', (i.physical_quantity - i.reserved_quantity)
            )
          ) FILTER (WHERE soi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM sales_orders so
      JOIN quotations q ON so.quotation_id = q.id
      JOIN enquiries e ON q.enquiry_id = e.id
      JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u_cre ON so.created_by = u_cre.id
      LEFT JOIN users u_conf ON so.confirmed_by = u_conf.id
      LEFT JOIN dispatches d ON so.id = d.sales_order_id
      LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE so.id = $1
      GROUP BY so.id, q.quotation_number, q.enquiry_id, e.enquiry_number, c.company_name, c.contact_person, c.email, c.mobile, c.city, u_cre.name, u_conf.name, d.id, d.dispatch_number, d.vehicle_number, d.driver_name, d.dispatch_date
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }
    return res.json({
      success: true,
      sales_order: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching sales order by ID:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sales order' });
  }
}

/**
 * Requirement 6: Inventory Reservation upon Admin confirmation
 * Concurrency protected via PostgreSQL FOR UPDATE row-level locking.
 */
async function confirmSalesOrder(req, res) {
  const { id } = req.params;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock the sales order row
    const soRes = await client.query(
      'SELECT id, order_number, status FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (soRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }

    const order = soRes.rows[0];

    if (order.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only PENDING orders can be confirmed. Current status: ${order.status}`,
      });
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      'SELECT product_id, quantity FROM sales_order_items WHERE sales_order_id = $1',
      [id]
    );

    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Sales order has no items to reserve' });
    }

    // 3. For each item, lock inventory row FOR UPDATE to prevent race conditions
    // Order products by product_id to prevent any potential database deadlocks in concurrent requests
    const sortedItems = [...itemsRes.rows].sort((a, b) => a.product_id - b.product_id);

    for (const item of sortedItems) {
      const invRes = await client.query(
        `SELECT i.product_id, p.product_name, p.product_code, i.physical_quantity, i.reserved_quantity,
                (i.physical_quantity - i.reserved_quantity) AS available_quantity
         FROM inventory i
         JOIN products p ON i.product_id = p.id
         WHERE i.product_id = $1
         FOR UPDATE`,
        [item.product_id]
      );

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Inventory record missing for product ID ${item.product_id}`,
        });
      }

      const inv = invRes.rows[0];
      const available = parseInt(inv.available_quantity, 10);
      const required = parseInt(item.quantity, 10);

      // Concurrency check: Cannot reserve more than available inventory!
      if (available < required) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory for product "${inv.product_name}" (${inv.product_code}). Available: ${available}, Required: ${required}. Reservation denied.`,
          shortage: {
            product_id: item.product_id,
            product_name: inv.product_name,
            available,
            required,
          },
        });
      }

      // Update inventory: Physical does NOT decrease, Reserved INCREASES
      await client.query(
        `UPDATE inventory
         SET reserved_quantity = reserved_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2`,
        [required, item.product_id]
      );
    }

    // 4. Update Sales Order status to CONFIRMED
    const updatedOrderRes = await client.query(
      `UPDATE sales_orders
       SET status = 'CONFIRMED',
           confirmed_by = $1,
           confirmed_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.user.id, id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Sales Order ${order.order_number} confirmed and stock reserved successfully`,
      sales_order: updatedOrderRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirming sales order:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm sales order and reserve inventory',
    });
  } finally {
    client.release();
  }
}

/**
 * Cancellation feature (Ready for Live Verification round!)
 * Allows a confirmed order to be cancelled and automatically releases its reserved stock.
 */
async function cancelSalesOrder(req, res) {
  const { id } = req.params;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const soRes = await client.query(
      'SELECT id, order_number, status FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (soRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }

    const order = soRes.rows[0];

    if (order.status === 'DISPATCHED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot cancel an already dispatched order' });
    }

    if (order.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Sales Order is already cancelled' });
    }

    // If order was CONFIRMED, release the reserved inventory!
    if (order.status === 'CONFIRMED') {
      const itemsRes = await client.query(
        'SELECT product_id, quantity FROM sales_order_items WHERE sales_order_id = $1',
        [id]
      );

      for (const item of itemsRes.rows) {
        await client.query(
          `UPDATE inventory
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
               updated_at = CURRENT_TIMESTAMP
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    const updateRes = await client.query(
      "UPDATE sales_orders SET status = 'CANCELLED' WHERE id = $1 RETURNING *",
      [id]
    );

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: `Sales Order ${order.order_number} cancelled and reserved stock released`,
      sales_order: updateRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling sales order:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel sales order' });
  } finally {
    client.release();
  }
}

module.exports = {
  getSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
  cancelSalesOrder,
};
