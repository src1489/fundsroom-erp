/**
 * Centralized API client service for Fundsroom Industrial ERP
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('erp_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  auth: {
    login: (email, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    getMe: () => request('/auth/me'),
  },

  // Customers
  customers: {
    getAll: () => request('/customers'),
    create: (data) =>
      request('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Products
  products: {
    getAll: () => request('/products'),
    create: (data) =>
      request('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Inventory
  inventory: {
    getAll: () => request('/inventory'),
    update: (productId, physicalQuantity) =>
      request('/inventory', {
        method: 'PUT',
        body: JSON.stringify({ product_id: productId, physical_quantity: physicalQuantity }),
      }),
  },

  // Enquiries
  enquiries: {
    getAll: () => request('/enquiries'),
    getById: (id) => request(`/enquiries/${id}`),
    create: (data) =>
      request('/enquiries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id, status) =>
      request(`/enquiries/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  // Quotations
  quotations: {
    getAll: () => request('/quotations'),
    getById: (id) => request(`/quotations/${id}`),
    create: (data) =>
      request('/quotations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (id, status) =>
      request(`/quotations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    convertToOrder: (id) =>
      request(`/quotations/${id}/convert`, {
        method: 'POST',
      }),
  },

  // Sales Orders
  salesOrders: {
    getAll: () => request('/sales-orders'),
    getById: (id) => request(`/sales-orders/${id}`),
    confirm: (id) =>
      request(`/sales-orders/${id}/confirm`, {
        method: 'POST',
      }),
    dispatch: (id, data) =>
      request(`/sales-orders/${id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    cancel: (id) =>
      request(`/sales-orders/${id}/cancel`, {
        method: 'POST',
      }),
  },

  // Dispatches
  dispatches: {
    getAll: () => request('/dispatches'),
  },
};
