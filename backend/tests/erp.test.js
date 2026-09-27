const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { adminToken, salesToken } = require('./helpers');
const seed = require('../src/scripts/seed');
const migrate = require('../src/scripts/migrate');

beforeAll(async () => {
  // Fresh migration and seed before running tests
  await migrate();
  await seed();
});

afterAll(async () => {
  await pool.end();
});

describe('Fundsroom Industrial ERP Integration Tests', () => {

  // TEST 1: Quotation total is calculated correctly (backend validation)
  describe('Test 1: Quotation Calculation & Backend Enforced Totals', () => {
    it('should correctly calculate line items, discounts, GST, and enforce backend totals even if frontend attempts tampering', async () => {
      // Fetch enquiry and a product
      const enqRes = await pool.query('SELECT id, customer_id FROM enquiries LIMIT 1');
      const enquiry = enqRes.rows[0];

      const prodRes = await pool.query("SELECT id FROM products WHERE product_code = 'PROD-VLV-01'");
      const productId = prodRes.rows[0].id;

      // Item specs: Qty = 10, Unit Price = 4500, Discount = 10%, GST = 18%
      // Base: 45000, Discount: 4500, Taxable: 40500, GST: 7290, Line Amount: 47790
      const payload = {
        enquiry_id: enquiry.id,
        valid_until: '2026-12-31',
        grand_total: 100.00, // Intentional client tampering! Backend must recalculate and overwrite!
        items: [
          {
            product_id: productId,
            quantity: 10,
            unit_price: 4500,
            discount_percentage: 10,
            gst_percentage: 18,
          },
        ],
      };

      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      const quotation = res.body.quotation;
      expect(parseFloat(quotation.subtotal)).toBe(45000);
      expect(parseFloat(quotation.total_discount)).toBe(4500);
      expect(parseFloat(quotation.total_tax)).toBe(7290);
      expect(parseFloat(quotation.grand_total)).toBe(47790); // Tampered 100 was rejected!

      const item = quotation.items[0];
      expect(parseFloat(item.base_amount)).toBe(45000);
      expect(parseFloat(item.discount_amount)).toBe(4500);
      expect(parseFloat(item.taxable_amount)).toBe(40500);
      expect(parseFloat(item.gst_amount)).toBe(7290);
      expect(parseFloat(item.line_amount)).toBe(47790);
    });
  });

  // TEST 2: Rejected/Draft quotation cannot create a Sales Order
  describe('Test 2: Quotation Status Rules for Sales Order Conversion', () => {
    let draftQuotationId;
    let rejectedQuotationId;

    beforeAll(async () => {
      const enqRes = await pool.query('SELECT id FROM enquiries LIMIT 1');
      const prodRes = await pool.query('SELECT id, base_price FROM products LIMIT 1');

      // Create a DRAFT quotation
      const q1 = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enqRes.rows[0].id,
          valid_until: '2026-12-31',
          items: [{ product_id: prodRes.rows[0].id, quantity: 5, unit_price: prodRes.rows[0].base_price }],
        });
      draftQuotationId = q1.body.quotation.id;

      // Create and REJECT a quotation
      const q2 = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enqRes.rows[0].id,
          valid_until: '2026-12-31',
          items: [{ product_id: prodRes.rows[0].id, quantity: 5, unit_price: prodRes.rows[0].base_price }],
        });
      rejectedQuotationId = q2.body.quotation.id;
      await request(app)
        .patch(`/api/quotations/${rejectedQuotationId}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'REJECTED' });
    });

    it('should reject converting a DRAFT quotation into a Sales Order', async () => {
      const res = await request(app)
        .post(`/api/quotations/${draftQuotationId}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot convert DRAFT quotation/i);
    });

    it('should reject converting a REJECTED quotation into a Sales Order', async () => {
      const res = await request(app)
        .post(`/api/quotations/${rejectedQuotationId}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot convert REJECTED quotation/i);
    });
  });

  // TEST 3: Same quotation cannot generate duplicate Sales Orders
  describe('Test 3: Prevent Duplicate Sales Orders from a Single Quotation', () => {
    let acceptedQuotationId;

    beforeAll(async () => {
      const enqRes = await pool.query('SELECT id FROM enquiries LIMIT 1');
      const prodRes = await pool.query('SELECT id, base_price FROM products LIMIT 1');

      // Create quotation and mark ACCEPTED
      const q = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enqRes.rows[0].id,
          valid_until: '2026-12-31',
          items: [{ product_id: prodRes.rows[0].id, quantity: 2, unit_price: prodRes.rows[0].base_price }],
        });
      acceptedQuotationId = q.body.quotation.id;

      await request(app)
        .patch(`/api/quotations/${acceptedQuotationId}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'ACCEPTED' });
    });

    it('should allow first conversion to Sales Order but block second conversion attempt', async () => {
      // 1. First conversion should succeed
      const firstRes = await request(app)
        .post(`/api/quotations/${acceptedQuotationId}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(firstRes.statusCode).toBe(201);
      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.sales_order).toBeDefined();

      // 2. Second conversion of identical quotation must be rejected
      const secondRes = await request(app)
        .post(`/api/quotations/${acceptedQuotationId}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);

      expect(secondRes.statusCode).toBe(400);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message).toMatch(/already been generated/i);
    });
  });

  // TEST 4: Cannot reserve more than available inventory
  describe('Test 4: Inventory Reservation Guard', () => {
    it('should fail confirmation when sales order requires more stock than currently available', async () => {
      // Find Centrifugal Pump (Physical = 50, Reserved = 0, Available = 50)
      const prodRes = await pool.query("SELECT id, base_price FROM products WHERE product_code = 'PROD-PMP-02'");
      const pmpId = prodRes.rows[0].id;
      const enqRes = await pool.query('SELECT id FROM enquiries LIMIT 1');

      // Create quotation for 80 units (Available is only 50!)
      const qRes = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enqRes.rows[0].id,
          valid_until: '2026-12-31',
          items: [{ product_id: pmpId, quantity: 80, unit_price: prodRes.rows[0].base_price }],
        });

      const qId = qRes.body.quotation.id;
      await request(app)
        .patch(`/api/quotations/${qId}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'ACCEPTED' });

      // Convert to Sales Order
      const soRes = await request(app)
        .post(`/api/quotations/${qId}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);
      const orderId = soRes.body.sales_order.id;

      // Admin attempts to confirm order (requires 80, available is 50)
      const confirmRes = await request(app)
        .post(`/api/sales-orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(confirmRes.statusCode).toBe(400);
      expect(confirmRes.body.success).toBe(false);
      expect(confirmRes.body.message).toMatch(/Insufficient inventory/i);

      // Verify stock was not reserved
      const invCheck = await pool.query('SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1', [pmpId]);
      expect(parseInt(invCheck.rows[0].reserved_quantity, 10)).toBe(0);
    });
  });

  // TEST 5: Unauthorized user cannot perform a restricted operation (RBAC)
  describe('Test 5: Strict Backend RBAC Authorization', () => {
    it('should forbid Sales user from confirming a sales order (Admin only)', async () => {
      const res = await request(app)
        .post('/api/sales-orders/1/confirm')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it('should forbid Sales user from dispatching an order (Admin only)', async () => {
      const res = await request(app)
        .post('/api/sales-orders/1/dispatch')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ vehicle_number: 'MH-12-AB-1234', driver_name: 'Suresh' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it('should forbid Sales user from modifying inventory (Admin only)', async () => {
      const res = await request(app)
        .put('/api/inventory')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ product_id: 1, physical_quantity: 999 });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });

  // Simultaneous inventory reservations (Concurrency race condition)
  describe('Concurrency and Race Condition Handling', () => {
    it('should handle simultaneous reservation requests and ensure both cannot succeed when stock is insufficient', async () => {
      // Setup a fresh test product with exactly Physical = 100, Reserved = 0, Available = 100
      const prodRes = await pool.query(
        `INSERT INTO products (product_code, product_name, category, unit, base_price)
         VALUES ('PROD-CONC-TEST', 'Concurrency Test Item', 'Test', 'PCS', 100.00)
         RETURNING id, base_price`
      );
      const testProdId = prodRes.rows[0].id;

      await pool.query(
        `INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
         VALUES ($1, 100, 0)`,
        [testProdId]
      );

      const enqRes = await pool.query('SELECT id FROM enquiries LIMIT 1');
      const enquiryId = enqRes.rows[0].id;

      // Order A requires 80 units
      const qA = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enquiryId,
          valid_until: '2026-12-31',
          items: [{ product_id: testProdId, quantity: 80, unit_price: 100 }],
        });
      await request(app)
        .patch(`/api/quotations/${qA.body.quotation.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'ACCEPTED' });
      const orderARes = await request(app)
        .post(`/api/quotations/${qA.body.quotation.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);
      const orderAId = orderARes.body.sales_order.id;

      // Order B requires 50 units
      const qB = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enquiryId,
          valid_until: '2026-12-31',
          items: [{ product_id: testProdId, quantity: 50, unit_price: 100 }],
        });
      await request(app)
        .patch(`/api/quotations/${qB.body.quotation.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'ACCEPTED' });
      const orderBRes = await request(app)
        .post(`/api/quotations/${qB.body.quotation.id}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);
      const orderBId = orderBRes.body.sales_order.id;

      // SIMULTANEOUS CONCURRENT CONFIRMATION ATTEMPTS:
      // Available = 100
      // Request A requests 80
      // Request B requests 50
      // 80 + 50 = 130 > 100
      // Both CANNOT succeed! Exactly ONE must succeed and one must fail!
      const [resA, resB] = await Promise.all([
        request(app).post(`/api/sales-orders/${orderAId}/confirm`).set('Authorization', `Bearer ${adminToken}`),
        request(app).post(`/api/sales-orders/${orderBId}/confirm`).set('Authorization', `Bearer ${adminToken}`),
      ]);

      const statuses = [resA.statusCode, resB.statusCode];
      expect(statuses).toContain(200); // One succeeded
      expect(statuses).toContain(400); // One failed with insufficient inventory

      // Verify that reserved inventory in the database NEVER exceeded 100
      const finalInv = await pool.query(
        'SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1',
        [testProdId]
      );
      const reserved = parseInt(finalInv.rows[0].reserved_quantity, 10);
      expect(reserved).toBeLessThanOrEqual(100);
      expect([80, 50]).toContain(reserved);
    });
  });

  // Additional End-to-End Workflow Verification: Dispatch & Inventory Reduction
  describe('Full Workflow: Dispatch Execution and Physical/Reserved Inventory Reduction', () => {
    it('should complete the entire workflow through dispatch, reducing both physical and reserved stock', async () => {
      // Use Ball Valve (PROD-VLV-01)
      const prodRes = await pool.query("SELECT id, base_price FROM products WHERE product_code = 'PROD-VLV-01'");
      const pId = prodRes.rows[0].id;

      // Check initial stock
      const initialInv = await pool.query('SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1', [pId]);
      const initPhysical = parseInt(initialInv.rows[0].physical_quantity, 10);
      const initReserved = parseInt(initialInv.rows[0].reserved_quantity, 10);

      const enqRes = await pool.query('SELECT id FROM enquiries LIMIT 1');

      // 1. Create quotation for 20 units
      const qRes = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          enquiry_id: enqRes.rows[0].id,
          valid_until: '2026-12-31',
          items: [{ product_id: pId, quantity: 20, unit_price: prodRes.rows[0].base_price }],
        });
      const qId = qRes.body.quotation.id;

      // 2. Accept quotation
      await request(app)
        .patch(`/api/quotations/${qId}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'ACCEPTED' });

      // 3. Convert to Sales Order
      const soRes = await request(app)
        .post(`/api/quotations/${qId}/convert`)
        .set('Authorization', `Bearer ${salesToken}`);
      const orderId = soRes.body.sales_order.id;

      // 4. Confirm Sales Order (Reserve stock)
      const confRes = await request(app)
        .post(`/api/sales-orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(confRes.statusCode).toBe(200);

      // Verify reservation: Physical unchanged, Reserved + 20
      const postConfInv = await pool.query('SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1', [pId]);
      expect(parseInt(postConfInv.rows[0].physical_quantity, 10)).toBe(initPhysical);
      expect(parseInt(postConfInv.rows[0].reserved_quantity, 10)).toBe(initReserved + 20);

      // 5. Dispatch Order
      const dispRes = await request(app)
        .post(`/api/sales-orders/${orderId}/dispatch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vehicle_number: 'MH-12-GT-8844',
          driver_name: 'Ramesh Pawar',
          notes: 'Standard transport dispatch',
        });

      expect(dispRes.statusCode).toBe(201);
      expect(dispRes.body.success).toBe(true);

      // Verify dispatch effect: Physical - 20 AND Reserved - 20
      const postDispInv = await pool.query('SELECT physical_quantity, reserved_quantity FROM inventory WHERE product_id = $1', [pId]);
      expect(parseInt(postDispInv.rows[0].physical_quantity, 10)).toBe(initPhysical - 20);
      expect(parseInt(postDispInv.rows[0].reserved_quantity, 10)).toBe(initReserved);

      // 6. Verify duplicate dispatch prevention
      const dupDispRes = await request(app)
        .post(`/api/sales-orders/${orderId}/dispatch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vehicle_number: 'MH-12-GT-8844',
          driver_name: 'Ramesh Pawar',
        });
      expect(dupDispRes.statusCode).toBe(400);
      expect(dupDispRes.body.message).toMatch(/already been dispatched/i);
    });
  });
});
