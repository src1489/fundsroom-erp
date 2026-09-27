const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');

function generateToken(user) {
  return jwt.sign(
    user,
    process.env.JWT_SECRET || 'fundsroom_erp_super_secret_jwt_key_2026',
    { expiresIn: '1h' }
  );
}

const adminUser = {
  id: 1,
  name: 'Admin Operations',
  email: 'admin@fundsroom.com',
  role: 'ADMIN',
};

const salesUser = {
  id: 2,
  name: 'Rohan Verma (Sales)',
  email: 'sales@fundsroom.com',
  role: 'SALES',
};

const adminToken = generateToken(adminUser);
const salesToken = generateToken(salesUser);

module.exports = {
  adminUser,
  salesUser,
  adminToken,
  salesToken,
  generateToken,
};
