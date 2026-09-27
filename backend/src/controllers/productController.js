const db = require('../config/db');

async function getProducts(req, res) {
  try {
    const query = `
      SELECT 
        p.id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        p.created_at,
        COALESCE(i.physical_quantity, 0) AS physical_quantity,
        COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
        (COALESCE(i.physical_quantity, 0) - COALESCE(i.reserved_quantity, 0)) AS available_quantity
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      ORDER BY p.id ASC
    `;
    const result = await db.query(query);
    return res.json({
      success: true,
      products: result.rows,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products' });
  }
}

async function createProduct(req, res) {
  const { product_code, product_name, category, unit, base_price, initial_stock } = req.body;

  if (!product_code || !product_name || !category || !unit || base_price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Product code, name, category, unit, and base price are required',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const prodRes = await client.query(
      `INSERT INTO products (product_code, product_name, category, unit, base_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [product_code.trim(), product_name.trim(), category.trim(), unit.trim(), parseFloat(base_price)]
    );
    const product = prodRes.rows[0];

    const stock = Math.max(0, parseInt(initial_stock || 0, 10));
    await client.query(
      `INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
       VALUES ($1, $2, 0)`,
      [product.id, stock]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: {
        ...product,
        physical_quantity: stock,
        reserved_quantity: 0,
        available_quantity: stock,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Product code already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create product' });
  } finally {
    client.release();
  }
}

module.exports = {
  getProducts,
  createProduct,
};
