const db = require('../config/db');

async function getInventory(req, res) {
  try {
    const query = `
      SELECT 
        i.id AS inventory_id,
        p.id AS product_id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        i.physical_quantity,
        i.reserved_quantity,
        (i.physical_quantity - i.reserved_quantity) AS available_quantity,
        i.updated_at
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      ORDER BY p.id ASC
    `;
    const result = await db.query(query);
    return res.json({
      success: true,
      inventory: result.rows,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory' });
  }
}

async function updateInventory(req, res) {
  const { product_id, physical_quantity } = req.body;

  if (!product_id || physical_quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Product ID and physical quantity are required',
    });
  }

  const newPhysicalQty = parseInt(physical_quantity, 10);
  if (isNaN(newPhysicalQty) || newPhysicalQty < 0) {
    return res.status(400).json({
      success: false,
      message: 'Physical quantity cannot be negative',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock the inventory row for update
    const curRes = await client.query(
      'SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
      [product_id]
    );

    if (curRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }

    const { reserved_quantity } = curRes.rows[0];

    // System rule: prevent setting physical quantity below already reserved stock
    if (newPhysicalQty < reserved_quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Invalid inventory update: Physical quantity (${newPhysicalQty}) cannot be less than already reserved quantity (${reserved_quantity})`,
      });
    }

    const updateRes = await client.query(
      `UPDATE inventory
       SET physical_quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE product_id = $2
       RETURNING product_id, physical_quantity, reserved_quantity, (physical_quantity - reserved_quantity) AS available_quantity`,
      [newPhysicalQty, product_id]
    );

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'Inventory updated successfully',
      inventory: updateRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating inventory:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inventory' });
  } finally {
    client.release();
  }
}

module.exports = {
  getInventory,
  updateInventory,
};
