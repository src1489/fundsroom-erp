-- Industrial ERP Database Schema for Fundsroom Infotech Technical Case Study
-- PostgreSQL Database Initialization

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS dispatch_items CASCADE;
DROP TABLE IF EXISTS dispatches CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS quotation_items CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS enquiry_items CASCADE;
DROP TABLE IF EXISTS enquiries CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table (Authentication & RBAC)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'SALES')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    mobile VARCHAR(30) NOT NULL,
    email VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Table (Master Data)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Inventory Table
-- Critical constraints:
-- - physical_quantity >= 0
-- - reserved_quantity >= 0
-- - physical_quantity >= reserved_quantity (prevents negative available stock!)
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    physical_quantity INTEGER NOT NULL DEFAULT 0 CHECK (physical_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_available_stock CHECK (physical_quantity >= reserved_quantity)
);

-- 5. Enquiries Table
-- Statuses: NEW -> QUOTED -> WON / LOST
CREATE TABLE enquiries (
    id SERIAL PRIMARY KEY,
    enquiry_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'QUOTED', 'WON', 'LOST')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Enquiry Items (Multi-product support)
CREATE TABLE enquiry_items (
    id SERIAL PRIMARY KEY,
    enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- 7. Quotations Table
-- Statuses: DRAFT -> SENT -> ACCEPTED / REJECTED
CREATE TABLE quotations (
    id SERIAL PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE RESTRICT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12, 2) NOT NULL CHECK (grand_total >= 0),
    valid_until DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Quotation Items Table
CREATE TABLE quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18 CHECK (gst_percentage >= 0),
    base_amount NUMERIC(12, 2) NOT NULL CHECK (base_amount >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    taxable_amount NUMERIC(12, 2) NOT NULL CHECK (taxable_amount >= 0),
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount >= 0)
);

-- 9. Sales Orders Table
-- Statuses: PENDING -> CONFIRMED -> DISPATCHED -> CANCELLED
-- Note: quotation_id is UNIQUE to strictly prevent duplicate sales orders from a single quotation.
CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id INTEGER UNIQUE NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED')),
    confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Sales Order Items Table
CREATE TABLE sales_order_items (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount >= 0)
);

-- 11. Dispatches Table
-- sales_order_id is UNIQUE to prevent duplicate dispatches of the same order
CREATE TABLE dispatches (
    id SERIAL PRIMARY KEY,
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id INTEGER UNIQUE NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    dispatch_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vehicle_number VARCHAR(50) NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    notes TEXT,
    processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Dispatch Items Table
CREATE TABLE dispatch_items (
    id SERIAL PRIMARY KEY,
    dispatch_id INTEGER NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- Performance & Integrity Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_enquiries_customer ON enquiries(customer_id);
CREATE INDEX idx_enquiries_status ON enquiries(status);
CREATE INDEX idx_quotations_enquiry ON quotations(enquiry_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_sales_orders_quotation ON sales_orders(quotation_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_dispatches_sales_order ON dispatches(sales_order_id);
