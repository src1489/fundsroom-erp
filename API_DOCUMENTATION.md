# Fundsroom Industrial ERP - REST API Documentation

Base URL: `http://localhost:5000/api`

All protected endpoints require an HTTP header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

---

## 1. Authentication & RBAC

### `POST /auth/login`
Authenticates a user and issues a JWT token.
- **Access**: Public
- **Request Body**:
```json
{
  "email": "admin@fundsroom.com",
  "password": "admin123"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "name": "Admin Operations",
    "email": "admin@fundsroom.com",
    "role": "ADMIN"
  }
}
```

### `GET /auth/me`
Fetches current session user info.
- **Access**: Authenticated

---

## 2. Customer Enquiries

### `GET /enquiries`
Retrieves all enquiries with customer and requested line items.
- **Access**: `ADMIN`, `SALES`

### `POST /enquiries`
Creates a customer enquiry with multiple requested products.
- **Access**: `ADMIN`, `SALES`
- **Request Body**:
```json
{
  "customer_id": 1,
  "required_date": "2026-10-15",
  "notes": "Urgent requirement for plant maintenance",
  "items": [
    { "product_id": 1, "quantity": 100 },
    { "product_id": 4, "quantity": 40 },
    { "product_id": 3, "quantity": 200 }
  ]
}
```

### `PATCH /enquiries/:id/status`
Updates enquiry status (`NEW`, `QUOTED`, `WON`, `LOST`).
- **Access**: `ADMIN`, `SALES`

---

## 3. Commercial Quotations

### `GET /quotations`
Lists all quotations with linked enquiries and customers.
- **Access**: `ADMIN`, `SALES`

### `POST /quotations`
Generates a commercial quotation against an enquiry.
> **Note**: Final grand total, discounts, and GST are calculated and enforced by the backend. Client-tampered amounts are safely overwritten.
- **Access**: `ADMIN`, `SALES`
- **Request Body**:
```json
{
  "enquiry_id": 1,
  "valid_until": "2026-11-15",
  "items": [
    {
      "product_id": 1,
      "quantity": 10,
      "unit_price": 4500.00,
      "discount_percentage": 5.0,
      "gst_percentage": 18.0
    }
  ]
}
```

### `PATCH /quotations/:id/status`
Transitions quotation status (`DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`).
- **Access**: `ADMIN`, `SALES`

### `POST /quotations/:id/convert`
Converts an **`ACCEPTED`** quotation into a Sales Order.
- **Access**: `ADMIN`, `SALES`
- **Rules Enforced**:
  - DRAFT quotation returns `400 Bad Request`.
  - REJECTED quotation returns `400 Bad Request`.
  - One quotation cannot generate multiple Sales Orders (unique constraint).

---

## 4. Sales Orders & Inventory Reservation

### `GET /sales-orders`
Lists all sales orders with customer, items, and current status (`PENDING`, `CONFIRMED`, `DISPATCHED`, `CANCELLED`).
- **Access**: `ADMIN`, `SALES`

### `POST /sales-orders/:id/confirm`
Admin confirms sales order. Triggers atomic inventory reservation with row-level locking (`FOR UPDATE`).
- **Access**: `ADMIN` only (Returns `403 Forbidden` if called by Sales User)
- **Concurrency Safe**: Prevents race conditions when simultaneous requests compete for limited stock.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Sales Order SO-2026-0001 confirmed and stock reserved successfully",
  "sales_order": { ... }
}
```

### `POST /sales-orders/:id/dispatch`
Admin processes physical dispatch of a confirmed order.
- **Access**: `ADMIN` only
- **Effect**: Decreases `physical_quantity` AND decreases `reserved_quantity`.
- **Request Body**:
```json
{
  "vehicle_number": "MH-12-RN-5116",
  "driver_name": "Ramesh Shinde",
  "notes": "Loaded in Bay 2, gate pass #GP-109"
}
```

### `POST /sales-orders/:id/cancel`
Cancels an unfulfilled order and automatically releases any reserved inventory back to available stock.
- **Access**: `ADMIN` only

---

## 5. Product Master & Inventory Availability

### `GET /products`
Returns all products with their base prices and current inventory balances.

### `GET /inventory`
Returns all inventory records (`physical_quantity`, `reserved_quantity`, and `available_quantity`).

### `PUT /inventory`
Admin adjusts physical inventory quantity.
- **Access**: `ADMIN` only
- **Validation**: Rejects negative numbers and prevents setting physical quantity below already reserved stock.
