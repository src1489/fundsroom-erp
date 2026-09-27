import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Layers, Edit3, AlertCircle, Check, Plus, Search, ShieldAlert } from 'lucide-react';

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Edit Stock Modal
  const [editItem, setEditItem] = useState(null);
  const [physicalQuantity, setPhysicalQuantity] = useState('');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.inventory.getAll();
      setInventory(res.inventory || []);
    } catch (err) {
      setError(err.message || 'Failed to load inventory stock');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item) => {
    setEditItem(item);
    setPhysicalQuantity(item.physical_quantity);
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!editItem) return;
    setError('');
    setSuccess('');

    try {
      const qty = parseInt(physicalQuantity, 10);
      if (isNaN(qty) || qty < 0) {
        throw new Error('Physical quantity cannot be negative');
      }

      const res = await api.inventory.update(editItem.product_id, qty);
      if (res.success) {
        setSuccess(`Inventory for ${editItem.product_name} updated successfully!`);
        setEditItem(null);
        loadInventory();
      }
    } catch (err) {
      setError(err.message || 'Failed to update inventory');
    }
  };

  const filteredInventory = inventory.filter((inv) => {
    return (
      inv.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Industrial Product Master & Inventory</h1>
          <p className="page-desc">
            Product catalog and real-time inventory ledger (Available Quantity = Physical Quantity − Reserved Quantity).
          </p>
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

      {/* Summary KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-val">{inventory.length}</div>
            <div className="stat-label">Industrial SKUs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <Check size={22} />
          </div>
          <div>
            <div className="stat-val">
              {inventory.reduce((sum, i) => sum + parseInt(i.physical_quantity || 0, 10), 0)}
            </div>
            <div className="stat-label">Total Physical Stock</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="stat-val">
              {inventory.reduce((sum, i) => sum + parseInt(i.reserved_quantity || 0, 10), 0)}
            </div>
            <div className="stat-label">Total Reserved Units</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Check size={22} />
          </div>
          <div>
            <div className="stat-val">
              {inventory.reduce((sum, i) => sum + parseInt(i.available_quantity || 0, 10), 0)}
            </div>
            <div className="stat-label">Net Available Stock</div>
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div
        className="glass-card"
        style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
          <Search
            size={18}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search by Code, Product Name, Category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Base Price (₹)</th>
                <th>Physical Stock</th>
                <th>Reserved Stock</th>
                <th>Available Stock</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading inventory master...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const avail = parseInt(item.available_quantity, 10);
                  const isLow = avail < 15;

                  return (
                    <tr key={item.product_id}>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>{item.product_code}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unit: {item.unit}</div>
                      </td>
                      <td>
                        <span style={{ background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <strong>₹{parseFloat(item.base_price).toLocaleString()}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.physical_quantity}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--warning)' }}>
                          {item.reserved_quantity}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: isLow ? '#f87171' : '#34d399',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isLow ? 'var(--danger-light)' : 'var(--success-light)',
                          }}
                        >
                          {item.available_quantity} {item.unit}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isAdmin ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenEdit(item)}
                            title="Adjust Physical Inventory"
                          >
                            <Edit3 size={14} />
                            <span>Adjust Stock</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title={`Adjust Physical Stock: ${editItem?.product_name}`}
        maxWidth="500px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditItem(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpdateStock}
            >
              Save Stock Adjustment
            </button>
          </>
        }
      >
        {editItem && (
          <form onSubmit={handleUpdateStock}>
            <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Product: {editItem.product_code}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>{editItem.product_name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--warning)', marginTop: '4px' }}>
                Currently Reserved: <strong>{editItem.reserved_quantity} {editItem.unit}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">New Physical Quantity *</label>
              <input
                type="number"
                min={editItem.reserved_quantity}
                className="form-control"
                value={physicalQuantity}
                onChange={(e) => setPhysicalQuantity(e.target.value)}
                required
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Note: Physical quantity cannot be lower than the already reserved quantity ({editItem.reserved_quantity}).
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
