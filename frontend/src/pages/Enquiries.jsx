import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import WorkflowTracker from '../components/WorkflowTracker';
import Modal from '../components/Modal';
import { Plus, Search, Building2, Calendar, FileText, AlertCircle, Check, Trash2, ArrowRight } from 'lucide-react';

export default function Enquiries({ onNavigateToQuotation }) {
  const { isSales, isAdmin } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Enquiry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // New Customer Fields
  const [newCust, setNewCust] = useState({
    company_name: '',
    contact_person: '',
    mobile: '',
    email: '',
    city: '',
  });

  // Multi-product line items
  const [items, setItems] = useState([
    { product_id: '', quantity: 1 },
  ]);

  // View Details Modal
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [enqRes, custRes, prodRes] = await Promise.all([
        api.enquiries.getAll(),
        api.customers.getAll(),
        api.products.getAll(),
      ]);
      setEnquiries(enqRes.enquiries || []);
      setCustomers(custRes.customers || []);
      setProducts(prodRes.products || []);
    } catch (err) {
      setError(err.message || 'Failed to load enquiry data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleOpenCreateModal = () => {
    // Default required date: 14 days ahead
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setRequiredDate(d.toISOString().split('T')[0]);
    setIsNewCustomer(false);
    setSelectedCustomerId(customers[0]?.id || '');
    setNotes('');
    setItems([{ product_id: products[0]?.id || '', quantity: 10 }]);
    setIsModalOpen(true);
  };

  const handleSubmitEnquiry = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      let customerId = selectedCustomerId;

      // If adding new customer
      if (isNewCustomer) {
        if (!newCust.company_name || !newCust.contact_person || !newCust.mobile || !newCust.email || !newCust.city) {
          throw new Error('Please fill all new customer fields');
        }
        const createdCust = await api.customers.create(newCust);
        customerId = createdCust.customer.id;
        // Refresh customer list
        const custRes = await api.customers.getAll();
        setCustomers(custRes.customers || []);
      }

      if (!customerId) {
        throw new Error('Please select or create a customer');
      }

      // Validate items
      const validItems = items.filter((item) => item.product_id && parseInt(item.quantity, 10) > 0);
      if (validItems.length === 0) {
        throw new Error('Please select at least one valid product and quantity');
      }

      const payload = {
        customer_id: customerId,
        required_date: requiredDate,
        notes,
        items: validItems.map((i) => ({
          product_id: parseInt(i.product_id, 10),
          quantity: parseInt(i.quantity, 10),
        })),
      };

      const res = await api.enquiries.create(payload);
      if (res.success) {
        setSuccess(`Enquiry ${res.enquiry.enquiry_number} created successfully!`);
        setIsModalOpen(false);
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Failed to create enquiry');
    }
  };

  // Filtered enquiries
  const filteredEnquiries = enquiries.filter((e) => {
    const matchesStatus = filterStatus === 'ALL' || e.status === filterStatus;
    const matchesSearch =
      e.enquiry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      {/* Workflow Stepper */}
      <WorkflowTracker currentStep={1} />

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Enquiries</h1>
          <p className="page-desc">
            Capture B2B enquiries, manage required delivery dates, and configure multi-product batches.
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={18} />
            <span>Create New Enquiry</span>
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

      {/* Filters & Search Toolbar */}
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
              placeholder="Search by Enquiry #, Customer, or City..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
          </div>
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'NEW', 'QUOTED', 'WON', 'LOST'].map((st) => (
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

      {/* Enquiries Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Enquiry Number</th>
                <th>Customer & Location</th>
                <th>Products Requested</th>
                <th>Enquiry Date</th>
                <th>Required By</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading customer enquiries...
                  </td>
                </tr>
              ) : filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No customer enquiries found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredEnquiries.map((enq) => {
                  const itemCount = enq.items?.length || 0;
                  const totalUnits = enq.items?.reduce((sum, i) => sum + parseInt(i.quantity || 0, 10), 0) || 0;

                  return (
                    <tr key={enq.id}>
                      <td>
                        <strong style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setSelectedEnquiry(enq)}>
                          {enq.enquiry_number}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          By: {enq.created_by_name || 'System'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{enq.company_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {enq.contact_person} • {enq.city}
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{itemCount} products</strong> ({totalUnits} total units)
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {enq.items?.map((i) => `${i.product_name} (${i.quantity})`).slice(0, 2).join(', ')}
                          {itemCount > 2 && '...'}
                        </div>
                      </td>
                      <td>{new Date(enq.enquiry_date).toLocaleDateString()}</td>
                      <td>{new Date(enq.required_date).toLocaleDateString()}</td>
                      <td>
                        <StatusBadge status={enq.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedEnquiry(enq)}
                          >
                            Details
                          </button>
                          {enq.status === 'NEW' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onNavigateToQuotation(enq)}
                              title="Create Quotation for this Enquiry"
                            >
                              <span>Quote</span>
                              <ArrowRight size={14} />
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

      {/* Create Enquiry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Customer Enquiry"
        maxWidth="850px"
        footer={
          <>
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
              onClick={handleSubmitEnquiry}
            >
              Submit Enquiry
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitEnquiry}>
          {/* Customer Selection or Quick Registration */}
          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} color="var(--primary)" />
                <span>Customer Information</span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
              >
                {isNewCustomer ? 'Select Existing Customer' : '+ Register New Customer'}
              </button>
            </div>

            {isNewCustomer ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="form-label">Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ABC Engineering Pvt. Ltd."
                    value={newCust.company_name}
                    onChange={(e) => setNewCust({ ...newCust, company_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Contact Person *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Rajesh Sharma"
                    value={newCust.contact_person}
                    onChange={(e) => setNewCust({ ...newCust, contact_person: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Mobile *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+91 98230 11223"
                    value={newCust.mobile}
                    onChange={(e) => setNewCust({ ...newCust, mobile: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="contact@abc.com"
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Pune"
                    value={newCust.city}
                    onChange={(e) => setNewCust({ ...newCust, city: e.target.value })}
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="form-label">Select Registered Customer *</label>
                <select
                  className="form-control"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.contact_person} - {c.city})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Enquiry Dates & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Required Delivery Date *</label>
              <input
                type="date"
                className="form-control"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Enquiry Notes / Requirements</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Delivery needed in single batch at Chakan plant"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Products Multi-Line Builder */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>Products & Quantity (Multi-item) *</label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAddItem}
              >
                <Plus size={14} /> Add Product Line
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item, idx) => {
                const prod = products.find((p) => p.id === parseInt(item.product_id, 10));

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3fr 1.5fr 1fr 40px',
                      gap: '12px',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <select
                        className="form-control"
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">-- Select Industrial Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.product_code} - {p.product_name} (Avail: {p.available_quantity} {p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {prod ? `${prod.unit} @ ₹${prod.base_price}` : ''}
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ padding: '6px', color: 'var(--danger)', borderColor: 'transparent' }}
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length === 1}
                      title="Remove product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Enquiry Details Drawer / Modal */}
      <Modal
        isOpen={!!selectedEnquiry}
        onClose={() => setSelectedEnquiry(null)}
        title={`Enquiry Details: ${selectedEnquiry?.enquiry_number}`}
        maxWidth="700px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              <StatusBadge status={selectedEnquiry?.status} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedEnquiry(null)}>
                Close
              </button>
              {selectedEnquiry?.status === 'NEW' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const enq = selectedEnquiry;
                    setSelectedEnquiry(null);
                    onNavigateToQuotation(enq);
                  }}
                >
                  Create Quotation
                </button>
              )}
            </div>
          </div>
        }
      >
        {selectedEnquiry && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '2px' }}>{selectedEnquiry.company_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Contact: {selectedEnquiry.contact_person}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mobile: {selectedEnquiry.mobile}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>City: {selectedEnquiry.city}</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Enquiry Info</div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Date: <strong>{new Date(selectedEnquiry.enquiry_date).toLocaleDateString()}</strong></div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Required By: <strong>{new Date(selectedEnquiry.required_date).toLocaleDateString()}</strong></div>
                <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Sales Rep: <strong>{selectedEnquiry.created_by_name || 'System'}</strong></div>
                {selectedEnquiry.notes && (
                  <div style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    Notes: {selectedEnquiry.notes}
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontWeight: 600, marginBottom: '10px' }}>Requested Products</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Code & Name</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Base Price</th>
                </tr>
              </thead>
              <tbody>
                {selectedEnquiry.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{item.product_code}</strong> - {item.product_name}
                    </td>
                    <td>{item.unit}</td>
                    <td>
                      <strong>{item.quantity}</strong>
                    </td>
                    <td>₹{parseFloat(item.base_price || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
