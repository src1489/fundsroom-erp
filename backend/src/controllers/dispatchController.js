const db = require('../config/db');

async function getDispatches(req, res) {
  try {
    const query = `
      SELECT 
        d.id,
        d.dispatch_number,
        d.sales_order_id,
        so.order_number,
        c.company_name,
        d.dispatch_date,
        d.vehicle_number,
        d.driver_name,
        d.notes,
        d.created_at,
        u.name AS processed_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', p.id,
              'product_code', p.product_code,
              'product_name', p.product_name,
              'unit', p.unit,
              'quantity', di.quantity
            )
          ) FILTER (WHERE di.id IS NOT NULL),
          '[]'
        ) AS items
      FROM dispatches d
      JOIN sales_orders so ON d.sales_order_id = so.id
      JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON d.processed_by = u.id
      LEFT JOIN dispatch_items di ON d.id = di.dispatch_id
      LEFT JOIN products p ON di.product_id = p.id
      GROUP BY d.id, so.order_number, c.company_name, u.name
      ORDER BY d.id DESC
    `;
    const result = await db.query(query);
    return res.json({
      success: true,
      dispatches: result.rows,
    });
  } catch (error) {
    console.error('Error fetching dispatches:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dispatches' });
  }
}

async function createDispatch(req, res) {
  const { id } = req.params; // Sales order ID
  const { vehicle_number, driver_name, notes } = req.body;

  if (!vehicle_number || !driver_name) {
    return res.status(400).json({
      success: false,
      message: 'Vehicle number and driver name are required for dispatch',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock Sales Order row
    const soRes = await client.query(
      'SELECT id, order_number, status FROM sales_orders WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (soRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }

    const order = soRes.rows[0];

    // Prevent dispatch of a cancelled order
    if (order.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot dispatch a cancelled Sales Order',
      });
    }

    // Prevent duplicate dispatch
    if (order.status === 'DISPATCHED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This Sales Order has already been dispatched. Duplicate dispatch is prevented.',
      });
    }

    // Must be in CONFIRMED status (which means inventory was reserved)
    if (order.status !== 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only CONFIRMED sales orders can be dispatched. Current status: ${order.status}`,
      });
    }

    // Check if dispatch record already exists
    const existingDispatchRes = await client.query(
      'SELECT id FROM dispatches WHERE sales_order_id = $1',
      [id]
    );
    if (existingDispatchRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'A dispatch record already exists for this Sales Order.',
      });
    }

    // 2. Fetch order items
    const itemsRes = await client.query(
      'SELECT product_id, quantity FROM sales_order_items WHERE sales_order_id = $1',
      [id]
    );

    if (itemsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Sales order has no items' });
    }

    // 3. For each item:
    // When stock is dispatched:
    // Physical Quantity DECREASES
    // AND Reserved Quantity DECREASES
    // Example from spec:
    // Before: Physical = 100, Reserved = 60, Available = 40. Dispatch = 60
    // After: Physical = 40, Reserved = 0, Available = 40.
    const sortedItems = [...itemsRes.rows].sort((a, b) => a.product_id - b.product_id);

    for (const item of sortedItems) {
      const invRes = await client.query(
        'SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
        [item.product_id]
      );

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Inventory record not found' });
      }

      const inv = invRes.rows[0];

      // Prevent dispatch beyond reserved quantity
      if (inv.reserved_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Cannot dispatch beyond reserved quantity. Reserved: ${inv.reserved_quantity}, Requested: ${item.quantity}`,
        });
      }

      // Check physical stock as well
      if (inv.physical_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Cannot dispatch beyond physical quantity. Physical: ${inv.physical_quantity}, Requested: ${item.quantity}`,
        });
      }

      // Decrement both physical and reserved
      await client.query(
        `UPDATE inventory
         SET physical_quantity = physical_quantity - $1,
             reserved_quantity = reserved_quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // 4. Generate unique sequential Dispatch Number
    const countRes = await client.query('SELECT COUNT(*) FROM dispatches');
    const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
    const year = new Date().getFullYear();
    const dispatchNumber = `DSP-${year}-${String(nextSeq).padStart(4, '0')}`;

    // 5. Create Dispatch record
    const dispRes = await client.query(
      `INSERT INTO dispatches (
         dispatch_number, sales_order_id, vehicle_number,
         driver_name, notes, processed_by
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dispatchNumber,
        id,
        vehicle_number.trim(),
        driver_name.trim(),
        notes || '',
        req.user.id,
      ]
    );
    const dispatch = dispRes.rows[0];

    // 6. Insert Dispatch Items
    for (const item of itemsRes.rows) {
      await client.query(
        `INSERT INTO dispatch_items (dispatch_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [dispatch.id, item.product_id, item.quantity]
      );
    }

    // 7. Update Sales Order status to DISPATCHED
    await client.query(
      "UPDATE sales_orders SET status = 'DISPATCHED' WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Sales Order ${order.order_number} successfully dispatched with ${dispatchNumber}`,
      dispatch: {
        ...dispatch,
        items: itemsRes.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing dispatch:', error);
    return res.status(500).json({ success: false, message: 'Failed to process dispatch' });
  } finally {
    client.release();
  }
}

module.exports = {
  getDispatches,
  createDispatch,
};
