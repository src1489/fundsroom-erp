import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import WorkflowTracker from '../components/WorkflowTracker';
import Modal from '../components/Modal';
import { Plus, Search, FileCheck, AlertCircle, Check, Trash2, ArrowRight, XCircle, ShoppingBag } from 'lucide-react';

export default function Quotations({ initialEnquiry, onNavigateToSalesOrders }) {
  const { isSales, isAdmin } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Quotation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState([]);

  // View Details Modal
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // If navigated from Enquiries with a specific enquiry
  useEffect(() => {
    if (initialEnquiry) {
      handleOpenCreateModal(initialEnquiry);
    }
  }, [initialEnquiry]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [quotRes, enqRes, prodRes] = await Promise.all([
        api.quotations.getAll(),
        api.enquiries.getAll(),
        api.products.getAll(),
      ]);
      setQuotations(quotRes.quotations || []);
      setEnquiries(enqRes.enquiries || []);
      setProducts(prodRes.products || []);
    } catch (err) {
      setError(err.message || 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = (preselectedEnq = null) => {
    const enq = preselectedEnq || enquiries.find((e) => e.status === 'NEW') || enquiries[0];
    const d = new Date();
    d.setDate(d.getDate() + 30); // 30 days validity
    setValidUntil(d.toISOString().split('T')[0]);

    if (enq) {
      setSelectedEnquiryId(enq.id);
      populateItemsFromEnquiry(enq);
    } else {
      setSelectedEnquiryId('');
      setItems([]);
    }
    setIsModalOpen(true);
  };

  const populateItemsFromEnquiry = (enquiry) => {
    if (!enquiry || !enquiry.items || enquiry.items.length === 0) {
      setItems([{ product_id: products[0]?.id || '', quantity: 1, unit_price: products[0]?.base_price || 0, discount_percentage: 0, gst_percentage: 18 }]);
      return;
    }

    const newItems = enquiry.items.map((ei) => {
      const prod = products.find((p) => p.id === ei.product_id) || {};
      return {
        product_id: ei.product_id,
        quantity: ei.quantity || 1,
        unit_price: parseFloat(prod.base_price || ei.base_price || 0),
        discount_percentage: 0,
        gst_percentage: 18,
      };
    });
    setItems(newItems);
  };

  const handleEnquiryChange = (enqId) => {
    setSelectedEnquiryId(enqId);
    const found = enquiries.find((e) => e.id === parseInt(enqId, 10));
    if (found) {
      populateItemsFromEnquiry(found);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // If product changed, update base price
    if (field === 'product_id') {
      const p = products.find((prod) => prod.id === parseInt(value, 10));
      if (p) {
        updated[index].unit_price = parseFloat(p.base_price);
      }
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    const defaultProd = products[0];
    setItems([
      ...items,
      {
        product_id: defaultProd?.id || '',
        quantity: 1,
        unit_price: parseFloat(defaultProd?.base_price || 0),
        discount_percentage: 0,
        gst_percentage: 18,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Live Calculation helper for display in modal
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const computedItems = items.map((item) => {
      const qty = parseInt(item.quantity, 10) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const disc = parseFloat(item.discount_percentage) || 0;
      const gst = parseFloat(item.gst_percentage) || 0;

      const baseAmount = Math.round(qty * price * 100) / 100;
      const discountAmount = Math.round(baseAmount * (disc / 100) * 100) / 100;
      const taxableAmount = Math.round((baseAmount - discountAmount) * 100) / 100;
      const gstAmount = Math.round(taxableAmount * (gst / 100) * 100) / 100;
      const lineAmount = Math.round((taxableAmount + gstAmount) * 100) / 100;

      subtotal += baseAmount;
      totalDiscount += discountAmount;
      totalTax += gstAmount;
      grandTotal += lineAmount;

      return {
        ...item,
        base_amount: baseAmount,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        gst_amount: gstAmount,
        line_amount: lineAmount,
      };
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      computedItems,
    };
  };

  const liveTotals = calculateTotals();

  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (!selectedEnquiryId) {
        throw new Error('Please select an enquiry');
      }

      const validItems = items.filter((i) => i.product_id && parseInt(i.quantity, 10) > 0);
      if (validItems.length === 0) {
        throw new Error('Please include at least one valid product');
      }

      const payload = {
        enquiry_id: parseInt(selectedEnquiryId, 10),
        valid_until: validUntil,
        items: validItems.map((i) => ({
          product_id: parseInt(i.product_id, 10),
          quantity: parseInt(i.quantity, 10),
          unit_price: parseFloat(i.unit_price),
          discount_percentage: parseFloat(i.discount_percentage || 0),
          gst_percentage: parseFloat(i.gst_percentage !== undefined ? i.gst_percentage : 18),
        })),
      };

      const res = await api.quotations.create(payload);
      if (res.success) {
        setSuccess(`Quotation ${res.quotation.quotation_number} generated with backend validated total: ₹${parseFloat(res.quotation.grand_total).toLocaleString()}`);
        setIsModalOpen(false);
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Failed to create quotation');
    }
  };

  const handleUpdateStatus = async (quotationId, newStatus) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.quotations.updateStatus(quotationId, newStatus);
      if (res.success) {
        setSuccess(`Quotation status updated to ${newStatus}`);
        loadData();
        if (selectedQuotation && selectedQuotation.id === quotationId) {
          setSelectedQuotation({ ...selectedQuotation, status: newStatus });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleConvertToSalesOrder = async (quotation) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.quotations.convertToOrder(quotation.id);
      if (res.success) {
        setSuccess(`Quotation ${quotation.quotation_number} successfully converted to Sales Order ${res.sales_order.order_number}!`);
        loadData();
        if (selectedQuotation) setSelectedQuotation(null);
        if (onNavigateToSalesOrders) {
          onNavigateToSalesOrders();
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to convert quotation to sales order');
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    const matchesStatus = filterStatus === 'ALL' || q.status === filterStatus;
    const matchesSearch =
      q.quotation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.enquiry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      {/* Workflow Stepper */}
      <WorkflowTracker currentStep={2} />

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Commercial Quotations</h1>
          <p className="page-desc">
            Generate formal B2B price quotations with discount structures, GST tax calculation, and convert accepted quotes to Sales Orders.
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => handleOpenCreateModal()}>
            <Plus size={18} />
            <span>Create Quotation</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div
        className="glass-card"
        style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search Quotation #, Enquiry #, Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
          </div>
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'].map((st) => (
            <button
              key={st}
              className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterStatus(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Enquiry Reference</th>
                <th>Customer</th>
                <th>Grand Total (₹)</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th>Linked Order</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading quotations...
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No quotations found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => {
                  return (
                    <tr key={q.id}>
                      <td>
                        <strong
                          style={{ color: 'var(--primary)', cursor: 'pointer' }}
                          onClick={() => setSelectedQuotation(q)}
                        >
                          {q.quotation_number}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Items: {q.items?.length || 0}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{q.enquiry_number}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{q.company_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {q.city}
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: '1rem', color: '#60a5fa' }}>
                          ₹{parseFloat(q.grand_total).toLocaleString()}
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Tax: ₹{parseFloat(q.total_tax).toLocaleString()}
                        </div>
                      </td>
                      <td>{new Date(q.valid_until).toLocaleDateString()}</td>
                      <td>
                        <StatusBadge status={q.status} />
                      </td>
                      <td>
                        {q.sales_order_id ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
                            {q.sales_order_number}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedQuotation(q)}
                          >
                            Details
                          </button>

                          {q.status === 'DRAFT' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleUpdateStatus(q.id, 'SENT')}
                              title="Mark Quotation as Sent to Customer"
                            >
                              Send
                            </button>
                          )}

                          {q.status === 'SENT' && (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleUpdateStatus(q.id, 'ACCEPTED')}
                                title="Customer Accepted Quotation"
                              >
                                Accept
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleUpdateStatus(q.id, 'REJECTED')}
                                title="Customer Rejected Quotation"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {q.status === 'ACCEPTED' && !q.sales_order_id && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleConvertToSalesOrder(q)}
                              title="Convert to Confirmed Sales Order"
                            >
                              <ShoppingBag size={14} />
                              <span>Create Order</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Quotation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate Commercial Quotation"
        maxWidth="950px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              Calculated Total: <span style={{ color: '#60a5fa' }}>₹{liveTotals.grandTotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitQuotation}
              >
                Generate Quotation
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmitQuotation}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Reference Customer Enquiry *</label>
              <select
                className="form-control"
                value={selectedEnquiryId}
                onChange={(e) => handleEnquiryChange(e.target.value)}
                required
              >
                <option value="">-- Choose Enquiry --</option>
                {enquiries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.enquiry_number} - {e.company_name} ({e.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Quotation Valid Until *</label>
              <input
                type="date"
                className="form-control"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Line items calculation table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>Quotation Line Items & Commercial Terms *</label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAddItem}
              >
                <Plus size={14} /> Add Product
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Product</th>
                    <th style={{ width: '12%' }}>Quantity</th>
                    <th style={{ width: '15%' }}>Unit Price (₹)</th>
                    <th style={{ width: '12%' }}>Discount %</th>
                    <th style={{ width: '10%' }}>GST %</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>Line Total (₹)</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const computed = liveTotals.computedItems[idx] || {};

                    return (
                      <tr key={idx}>
                        <td>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                            value={item.product_id}
                            onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                            required
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_code} - {p.product_name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            required
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                            required
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                            value={item.discount_percentage}
                            onChange={(e) => handleItemChange(idx, 'discount_percentage', e.target.value)}
                          />
                        </td>

                        <td>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                            value={item.gst_percentage}
                            onChange={(e) => handleItemChange(idx, 'gst_percentage', e.target.value)}
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{computed.line_amount ? computed.line_amount.toLocaleString() : '0.00'}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px', color: 'var(--danger)', border: 'none' }}
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Live Calculation Breakdown Card */}
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SUBTOTAL (BASE)</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>₹{liveTotals.subtotal.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL DISCOUNT</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px', color: '#34d399' }}>-₹{liveTotals.totalDiscount.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ESTIMATED GST</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>₹{liveTotals.totalTax.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GRAND TOTAL (ENFORCED)</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', marginTop: '2px', color: '#60a5fa' }}>₹{liveTotals.grandTotal.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Quotation Detail Modal */}
      <Modal
        isOpen={!!selectedQuotation}
        onClose={() => setSelectedQuotation(null)}
        title={`Quotation: ${selectedQuotation?.quotation_number}`}
        maxWidth="850px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusBadge status={selectedQuotation?.status} />
              {selectedQuotation?.sales_order_id && (
                <span style={{ fontSize: '0.82rem', color: 'var(--success)' }}>
                  (Converted to SO: {selectedQuotation.sales_order_number})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedQuotation?.status === 'DRAFT' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleUpdateStatus(selectedQuotation.id, 'SENT')}
                >
                  Mark as Sent
                </button>
              )}

              {selectedQuotation?.status === 'SENT' && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => handleUpdateStatus(selectedQuotation.id, 'ACCEPTED')}
                  >
                    Accept Quotation
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleUpdateStatus(selectedQuotation.id, 'REJECTED')}
                  >
                    Reject Quotation
                  </button>
                </>
              )}

              {selectedQuotation?.status === 'ACCEPTED' && !selectedQuotation?.sales_order_id && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleConvertToSalesOrder(selectedQuotation)}
                >
                  <ShoppingBag size={16} />
                  <span>Convert to Sales Order</span>
                </button>
              )}

              <button className="btn btn-outline" onClick={() => setSelectedQuotation(null)}>
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedQuotation && (
          <div>
            {/* Header info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '2px' }}>{selectedQuotation.company_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Contact: {selectedQuotation.contact_person}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email: {selectedQuotation.email}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>City: {selectedQuotation.city}</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quotation Details</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Enquiry Ref: <strong>{selectedQuotation.enquiry_number}</strong></div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Valid Until: <strong>{new Date(selectedQuotation.valid_until).toLocaleDateString()}</strong></div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Created By: <strong>{selectedQuotation.created_by_name || 'System'}</strong></div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ fontWeight: 600, marginBottom: '10px' }}>Quotation Products & Price Breakdown</div>
            <table className="data-table" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Discount</th>
                  <th>Taxable</th>
                  <th>GST</th>
                  <th style={{ textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedQuotation.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{item.product_code}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.product_name}</div>
                    </td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>₹{parseFloat(item.unit_price).toLocaleString()}</td>
                    <td>{item.discount_percentage}% (₹{parseFloat(item.discount_amount).toLocaleString()})</td>
                    <td>₹{parseFloat(item.taxable_amount).toLocaleString()}</td>
                    <td>{item.gst_percentage}% (₹{parseFloat(item.gst_amount).toLocaleString()})</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{parseFloat(item.line_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '280px', background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <span>₹{parseFloat(selectedQuotation.subtotal).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Discount:</span>
                  <span style={{ color: '#34d399' }}>-₹{parseFloat(selectedQuotation.total_discount).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GST Tax:</span>
                  <span>₹{parseFloat(selectedQuotation.total_tax).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontWeight: 800, fontSize: '1.05rem', color: '#60a5fa' }}>
                  <span>Grand Total:</span>
                  <span>₹{parseFloat(selectedQuotation.grand_total).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
