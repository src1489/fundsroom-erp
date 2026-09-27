# Fundsroom Industrial ERP - Technical Case Study Solution

Full Stack PERN (PostgreSQL + Express.js + React.js + Node.js) Enterprise Resource Planning application covering the B2B industrial sales & supply chain lifecycle:

$$\textbf{Customer Enquiry} \longrightarrow \textbf{Quotation} \longrightarrow \textbf{Sales Order} \longrightarrow \textbf{Inventory Reservation} \longrightarrow \textbf{Dispatch}$$

---

## 🌟 Key Engineering Highlights

1. **Relational Database Design (PostgreSQL)**:
   - True normalized 3NF relational design across 12 relational tables.
   - Enforced database-level check constraints: `CHECK (physical_quantity >= reserved_quantity)` mathematically preventing negative stock balances.
   - Unique constraints on `sales_orders(quotation_id)` and `dispatches(sales_order_id)` ensuring strict 1:1 business rules and preventing duplicate orders/dispatches.

2. **Backend Concurrency Challenge (Row-Level Locking)**:
   - When concurrent requests compete for scarce inventory (e.g., Available = 100, User A requests 80, User B requests 50), row-level locks via `SELECT ... FOR UPDATE` inside PostgreSQL transactions guarantee serializable execution. Only one reservation can succeed; the other is rejected with a descriptive HTTP 400 error.

3. **Backend-Enforced Monetary Calculations**:
   - Quotation line amounts, GST (18%), and commercial discounts are strictly computed on the Node.js backend. Any client-side parameter tampering is safely overwritten.

4. **Strict Backend Role-Based Access Control (RBAC)**:
   - JWT authentication with bcrypt password hashing.
   - Restricted endpoints (`/confirm`, `/dispatch`, `/inventory`) are protected at the backend middleware level. Unauthorized calls by Sales Users result in strict HTTP 403 Forbidden responses.

5. **100% Automated Test Suite (10 Passed Tests)**:
   - Covers all 5 mandatory test scenarios plus the bonus concurrency race-condition test and end-to-end dispatch verification.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS Design System with responsive glassmorphism.
- **Backend**: Node.js, Express.js, JWT, bcryptjs, CORS, dotenv.
- **Database**: PostgreSQL 14 (Connection pooling with `pg`).
- **Testing**: Jest, Supertest.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18+ or v20+)
- **PostgreSQL** running locally on port `5432`

### 2. Database Setup
Create the database in PostgreSQL:
```sql
CREATE DATABASE fundsroom_erp;
```

### 3. Environment Variables
In `backend/.env`:
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

### 4. Database Migrations & Realistic Seeds
Run migrations and seed the initial industrial products, users, inventory, and enquiries:
```bash
cd backend
npm run migrate
npm run seed
```

This seeds:
- **Admin**: `admin@fundsroom.com` / `admin123`
- **Sales User**: `sales@fundsroom.com` / `sales123`
- **6 Industrial Products**: Ball Valves, Centrifugal Slurry Pumps, Roller Bearings, Induction Motors, Flange Bolts, Variable Frequency Drives.
- **Initial sample enquiry** matching the PDF example (`ABC Engineering Pvt. Ltd.`).

---

## 🧪 Running Automated Tests

Run the full test suite with all 5 mandatory tests + concurrency bonus test:
```bash
cd backend
npm test
```

### Test Results Breakdown:
- ✅ **Test 1**: Quotation total is calculated and enforced correctly by the backend.
- ✅ **Test 2**: DRAFT and REJECTED quotations cannot create a Sales Order.
- ✅ **Test 3**: Same quotation cannot generate duplicate Sales Orders.
- ✅ **Test 4**: Cannot reserve more than available inventory.
- ✅ **Test 5**: Unauthorized user cannot perform restricted operations (Strict RBAC).
- ✅ **Bonus Test**: Simultaneous inventory reservations race-condition handling (`Promise.all`).
- ✅ **Workflow Test**: Physical and reserved stock deduction upon dispatch execution.

---

## 💻 Running the Application

### Start Backend API Server:
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### Start Frontend Application:
```bash
cd frontend
npm run dev
# App running at http://localhost:3000
```

---

## 🔑 Test Login Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@fundsroom.com` | `admin123` | View all records, manage inventory, confirm sales orders (reserves stock), process dispatches (reduces stock). |
| **SALES USER** | `sales@fundsroom.com` | `sales123` | Create customers, create enquiries, generate quotations, convert accepted quotes to sales orders, view stock availability. |

> **Pro Tip**: The login screen and navigation bar include one-click demo role switcher buttons to effortlessly switch between Admin and Sales user during live demonstration and grading!

---

## 📚 Supplementary Documentation

- **[Database Schema & ER Diagram](file:///C:/Users/Sneha/.gemini/antigravity-ide/scratch/fundsroom-erp/DATABASE_SCHEMA.md)**: Full Mermaid ER model, foreign keys, database check constraints, and row-level locking explanation.
- **[REST API Documentation](file:///C:/Users/Sneha/.gemini/antigravity-ide/scratch/fundsroom-erp/API_DOCUMENTATION.md)**: Detailed input/output payloads for every endpoint.
- **[Postman Collection](file:///C:/Users/Sneha/.gemini/antigravity-ide/scratch/fundsroom-erp/postman_collection.json)**: Ready-to-import Postman JSON collection.
- **Recorded Demo Video**: Included directly in the repository root as `fundsroom_erp_demo.webp`.

---

## 🎯 Live Verification Round Preparation

Shortlisted candidates will be asked to explain their architecture or make a 20-minute live modification:

### Scenario A: Add DAMAGED stock to Inventory
$$\text{Available} = \text{Physical} - \text{Reserved} - \text{Damaged}$$
1. **Database**:
   ```sql
   ALTER TABLE inventory ADD COLUMN damaged_quantity INTEGER NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0);
   ALTER TABLE inventory DROP CONSTRAINT chk_available_stock;
   ALTER TABLE inventory ADD CONSTRAINT chk_available_stock CHECK (physical_quantity >= (reserved_quantity + damaged_quantity));
   ```
2. **Backend**: Update `available_quantity` calculation in `SELECT` queries to `(physical_quantity - reserved_quantity - damaged_quantity)`.
3. **Frontend**: Add a column for Damaged stock in `Inventory.jsx` and display in the KPI cards.

### Scenario B: Order Cancellation & Inventory Release
Already implemented in `backend/src/controllers/salesOrderController.js` (`cancelSalesOrder`) and supported in the Sales Order modal. Cancelling a `CONFIRMED` order automatically decreases `reserved_quantity`, restoring net available stock immediately!
