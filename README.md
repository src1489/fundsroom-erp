# Fundsroom Industrial ERP

A full-stack enterprise resource planning (ERP) system designed for B2B industrial manufacturing and supply chain operations. It manages the complete order lifecycle from initial customer enquiry to dispatch:

Customer Enquiry -> Quotation -> Sales Order -> Inventory Reservation -> Dispatch

---

## Key Features

1. **Relational Database Design (PostgreSQL)**
   - Normalized relational schema across 12 tables.
   - Database-level check constraints to prevent negative stock (`physical_quantity >= reserved_quantity`).
   - Unique constraints on orders and dispatches to prevent duplicate processing.

2. **Concurrency Control with Row-Level Locking**
   - Uses PostgreSQL transactions with `SELECT ... FOR UPDATE` row locks to safely handle simultaneous reservation requests against limited inventory.
   - Prevents overselling and race conditions when multiple orders compete for the same stock.

3. **Server-Side Pricing & Tax Calculations**
   - Line totals, discount deductions, and 18% GST are calculated and validated on the backend.
   - Prevents client-side price tampering.

4. **Role-Based Access Control (RBAC)**
   - JWT-based authentication with bcrypt password hashing.
   - Role separation between Admin and Sales users. Protected operations (confirming orders, modifying inventory, processing dispatches) are restricted to Admin users.

5. **Automated Test Suite**
   - Automated integration tests covering pricing calculations, order conversion rules, inventory reservation constraints, permission checks, and concurrent stock requests.

---

## Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS
- **Backend**: Node.js, Express.js, JWT, bcryptjs, CORS
- **Database**: PostgreSQL (pg client with connection pooling)
- **Testing**: Jest, Supertest

---

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher) running locally on port 5432

### 2. Database Setup
Create the PostgreSQL database:
```sql
CREATE DATABASE fundsroom_erp;
```

### 3. Environment Variables
Configure database credentials in `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=fundsroom_erp
JWT_SECRET=fundsroom_erp_super_secret_jwt_key_2026
JWT_EXPIRES_IN=24h
```

### 4. Database Migration & Seed
Run migrations to create tables and seed default products, inventory, and user accounts:
```bash
cd backend
npm run migrate
npm run seed
```

Default seeded accounts:
- Admin: `admin@fundsroom.com` / `admin123`
- Sales: `sales@fundsroom.com` / `sales123`

---

## Running the Application

### 1. Start the Backend API Server
```bash
cd backend
npm run dev
```
The server will start on `http://localhost:5000`.
Health check endpoint: `http://localhost:5000/api/health`

### 2. Start the Frontend Application
```bash
cd frontend
npm run dev
```
The application will open on `http://localhost:3000`.

---

## Running Automated Tests

Run the test suite from the backend directory:
```bash
cd backend
npm test
```

Test coverage includes:
- Backend quotation calculation and price verification
- Validation that DRAFT and REJECTED quotations cannot convert to sales orders
- Prevention of duplicate sales orders for the same quotation
- Enforcement of inventory reservation limits against available stock
- Role-based authorization and forbidden endpoint access
- Concurrent reservation requests and race condition handling
- Stock deduction upon order dispatch

---

## User Roles & Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| Admin | admin@fundsroom.com | admin123 | View all records, manage inventory, confirm sales orders (reserve stock), process dispatches (deduct stock). |
| Sales User | sales@fundsroom.com | sales123 | Create customers, create enquiries, create quotations, convert accepted quotations to sales orders, view inventory balances. |

The login page provides quick sign-in buttons for both accounts for testing.

---

## Project Documentation

- [Database Schema & ER Model](./DATABASE_SCHEMA.md): Complete table structures, constraints, and relational model.
- [REST API Documentation](./API_DOCUMENTATION.md): Endpoint specifications, request parameters, and response structures.
- [Postman Collection](./postman_collection.json): Importable collection for testing API endpoints.

---

## Business Logic Notes

- Available Stock is calculated as:
  Available Quantity = Physical Quantity - Reserved Quantity
- When an order is confirmed by Admin, stock is reserved (Physical stays unchanged, Reserved increases).
- When an order is dispatched, goods leave the facility (both Physical and Reserved decrease by the dispatched quantity).
- If a confirmed order is cancelled, its reserved inventory is released back to available stock.
