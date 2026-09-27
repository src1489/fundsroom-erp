const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding initial data...');
    await client.query('BEGIN');

    // 1. Seed Users (ADMIN and SALES)
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const salesPasswordHash = await bcrypt.hash('sales123', 10);

    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES
       ('Admin Operations', 'admin@fundsroom.com', $1, 'ADMIN'),
       ('Rohan Verma (Sales)', 'sales@fundsroom.com', $2, 'SALES')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, name, email, role`,
      [adminPasswordHash, salesPasswordHash]
    );
    const adminUser = userRes.rows.find((u) => u.role === 'ADMIN');
    const salesUser = userRes.rows.find((u) => u.role === 'SALES');

    // 2. Seed Customers
    const custRes = await client.query(
      `INSERT INTO customers (company_name, contact_person, mobile, email, city) VALUES
       ('ABC Engineering Pvt. Ltd.', 'Rajesh Sharma', '+91 98230 11223', 'rajesh@abcengg.com', 'Pune'),
       ('Apex Precision Components', 'Sunita Deshmukh', '+91 98450 44556', 'contact@apexprecision.in', 'Mumbai'),
       ('Mahindra Heavy Industrial Corp', 'Amit Patil', '+91 97654 33221', 'apatil@mahindrasol.com', 'Nashik')
       RETURNING id, company_name`
    );
    const abcCustomer = custRes.rows.find((c) => c.company_name.includes('ABC Engineering'));

    // 3. Seed at least 6 Industrial Products with realistic sample data
    const prodRes = await client.query(
      `INSERT INTO products (product_code, product_name, category, unit, base_price) VALUES
       ('PROD-VLV-01', 'High-Pressure Ball Valve 2"', 'Valves', 'PCS', 4500.00),
       ('PROD-PMP-02', 'Heavy Duty Centrifugal Pump 5HP', 'Pumps', 'PCS', 28500.00),
       ('PROD-BRG-03', 'Spherical Roller Bearing 22215', 'Bearings', 'PCS', 3200.00),
       ('PROD-MOT-04', '3-Phase Induction Motor 10HP', 'Motors', 'PCS', 34000.00),
       ('PROD-BLT-05', 'High-Tensile Flange Bolts M16', 'Fasteners', 'SET', 450.00),
       ('PROD-VFD-06', 'Variable Frequency Drive 7.5kW', 'Electrical', 'PCS', 19800.00)
       RETURNING id, product_code, product_name, base_price`
    );

    // 4. Seed Inventory with realistic physical quantities
    // Available = Physical - Reserved
    const stockConfig = {
      'PROD-VLV-01': 200,
      'PROD-PMP-02': 50,
      'PROD-BRG-03': 300,
      'PROD-MOT-04': 40,
      'PROD-BLT-05': 500,
      'PROD-VFD-06': 60,
    };

    for (const prod of prodRes.rows) {
      const physicalQty = stockConfig[prod.product_code] || 100;
      await client.query(
        `INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
         VALUES ($1, $2, 0)
         ON CONFLICT (product_id) DO UPDATE SET
           physical_quantity = EXCLUDED.physical_quantity,
           reserved_quantity = 0`,
        [prod.id, physicalQty]
      );
    }

    // 5. Seed sample Enquiry
    // Customer: ABC Engineering Pvt. Ltd.
    // Product A (Ball Valve): 100
    // Product B (Induction Motor): 40
    // Product C (Roller Bearing): 200
    const vlvProd = prodRes.rows.find((p) => p.product_code === 'PROD-VLV-01');
    const motProd = prodRes.rows.find((p) => p.product_code === 'PROD-MOT-04');
    const brgProd = prodRes.rows.find((p) => p.product_code === 'PROD-BRG-03');

    const enqRes = await client.query(
      `INSERT INTO enquiries (enquiry_number, customer_id, enquiry_date, required_date, notes, status, created_by)
       VALUES ('ENQ-2026-0001', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'Initial inquiry for batch production line expansion', 'NEW', $2)
       RETURNING id`,
      [abcCustomer.id, salesUser.id]
    );
    const enqId = enqRes.rows[0].id;

    await client.query(
      `INSERT INTO enquiry_items (enquiry_id, product_id, quantity) VALUES
       ($1, $2, 100),
       ($1, $3, 40),
       ($1, $4, 200)`,
      [enqId, vlvProd.id, motProd.id, brgProd.id]
    );

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');
    console.log('Credentials:');
    console.log('Admin: admin@fundsroom.com / admin123');
    console.log('Sales: sales@fundsroom.com / sales123');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    if (require.main === module) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
