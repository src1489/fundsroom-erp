import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Navbar from './components/Navbar';
import Enquiries from './pages/Enquiries';
import Quotations from './pages/Quotations';
import SalesOrders from './pages/SalesOrders';
import Inventory from './pages/Inventory';

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('enquiries');
  const [enquiryForQuote, setEnquiryForQuote] = useState(null);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-muted)',
          fontSize: '1rem',
        }}
      >
        Initializing Fundsroom Industrial ERP...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleNavigateToQuotation = (enquiry) => {
    setEnquiryForQuote(enquiry);
    setActiveTab('quotations');
  };

  const handleNavigateToSalesOrders = () => {
    setActiveTab('salesOrders');
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {activeTab === 'enquiries' && (
          <Enquiries onNavigateToQuotation={handleNavigateToQuotation} />
        )}
        {activeTab === 'quotations' && (
          <Quotations
            initialEnquiry={enquiryForQuote}
            onNavigateToSalesOrders={handleNavigateToSalesOrders}
          />
        )}
        {activeTab === 'salesOrders' && <SalesOrders />}
        {activeTab === 'inventory' && <Inventory />}
      </main>
    </div>
  );
}
