const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running database migrations from schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    if (require.main === module) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
