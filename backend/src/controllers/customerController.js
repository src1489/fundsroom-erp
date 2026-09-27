const db = require('../config/db');

async function getCustomers(req, res) {
  try {
    const result = await db.query(
      'SELECT id, company_name, contact_person, mobile, email, city, created_at FROM customers ORDER BY company_name ASC'
    );
    return res.json({
      success: true,
      customers: result.rows,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve customers' });
  }
}

async function createCustomer(req, res) {
  const { company_name, contact_person, mobile, email, city } = req.body;

  if (!company_name || !contact_person || !mobile || !email || !city) {
    return res.status(400).json({
      success: false,
      message: 'Company name, contact person, mobile, email, and city are all required',
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO customers (company_name, contact_person, mobile, email, city)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, company_name, contact_person, mobile, email, city, created_at`,
      [company_name.trim(), contact_person.trim(), mobile.trim(), email.trim(), city.trim()]
    );
    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
}

module.exports = {
  getCustomers,
  createCustomer,
};
