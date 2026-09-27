const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

// Test DB connection before starting server
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('CRITICAL: Database connection failed on startup!', err);
    process.exit(1);
  }
  console.log('PostgreSQL database connected successfully at:', res.rows[0].now);

  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Fundsroom Industrial ERP Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });

  const gracefulShutdown = () => {
    console.log('\nShutting down server gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      pool.end(() => {
        console.log('Database pool closed.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
});
