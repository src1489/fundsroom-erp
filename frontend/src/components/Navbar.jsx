import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Factory, User, LogOut, Shield, Briefcase, RefreshCw } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, isAdmin, isSales, logout, login } = useAuth();

  const handleSwitchRole = async (targetRole) => {
    if (targetRole === 'ADMIN') {
      await login('admin@fundsroom.com', 'admin123');
    } else {
      await login('sales@fundsroom.com', 'sales123');
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="nav-brand">
          <div className="brand-icon">
            <Factory size={22} color="#ffffff" />
          </div>
          <div>
            <div className="brand-title">Fundsroom ERP</div>
            <div className="brand-subtitle">Manufacturing & Supply Chain</div>
          </div>
        </div>

        {/* Navigation Tabs (The 4 Main Modules) */}
        <nav className="nav-links">
          <button
            className={`nav-item ${activeTab === 'enquiries' ? 'active' : ''}`}
            onClick={() => setActiveTab('enquiries')}
          >
            Enquiries
          </button>
          <button
            className={`nav-item ${activeTab === 'quotations' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotations')}
          >
            Quotations
          </button>
          <button
            className={`nav-item ${activeTab === 'salesOrders' ? 'active' : ''}`}
            onClick={() => setActiveTab('salesOrders')}
          >
            Sales Orders & Dispatch
          </button>
          <button
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory Availability
          </button>
        </nav>

        {/* User Profile & Demo Switcher */}
        <div className="nav-user">
          {/* Quick Demo Switcher */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Demo Role:</span>
            {isAdmin ? (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleSwitchRole('SALES')}
                title="Switch to Sales User"
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                <RefreshCw size={12} /> Switch to Sales
              </button>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleSwitchRole('ADMIN')}
                title="Switch to Admin"
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              >
                <RefreshCw size={12} /> Switch to Admin
              </button>
            )}
          </div>

          {/* Current User Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-surface)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-color)',
            }}
          >
            {isAdmin ? <Shield size={16} color="#3b82f6" /> : <Briefcase size={16} color="#10b981" />}
            <div style={{ lineHeight: '1.2' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</div>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: isAdmin ? '#60a5fa' : '#34d399',
                  textTransform: 'uppercase',
                }}
              >
                {user?.role}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            className="btn btn-outline btn-sm"
            onClick={logout}
            title="Logout"
            style={{ padding: '6px 10px' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
