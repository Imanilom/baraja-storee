const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('baraja_access_token');
  }
  return null;
};

export const setStoredUser = (user, token) => {
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('baraja_access_token', token);
    if (user) localStorage.setItem('baraja_user', JSON.stringify(user));
  }
};

export const getStoredUser = () => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('baraja_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

export const clearStoredAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('baraja_access_token');
    localStorage.removeItem('baraja_user');
  }
};

export async function fetchApi(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Request failed with status ${res.status}`);
  }

  return json;
}

export const api = {
  // Auth & Profile
  login: (email, password) =>
    fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  getMe: () => fetchApi('/auth/me'),
  getProfile: () => fetchApi('/auth/me'),
  updateProfile: (data) =>
    fetchApi('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  changePassword: (data) =>
    fetchApi('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Dashboard
  getDashboardMetrics: () => fetchApi('/dashboard'),

  // Master Data
  getProducts: () => fetchApi('/products'),
  getCategories: () => fetchApi('/products/categories'),
  getSuppliers: () => fetchApi('/suppliers'),
  createSupplier: (data) =>
    fetchApi('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Marketlists
  getMarketlists: (params = '') => fetchApi(`/marketlists${params}`),
  getMarketlistById: (id) => fetchApi(`/marketlists/${id}`),
  createMarketlist: (data) =>
    fetchApi('/marketlists', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  submitMarketlist: (id) =>
    fetchApi(`/marketlists/${id}/submit`, {
      method: 'POST'
    }),
  approveMarketlist: (id, note) =>
    fetchApi(`/marketlists/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }),
  rejectMarketlist: (id, reason) =>
    fetchApi(`/marketlists/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),
  requestRevision: (id, note) =>
    fetchApi(`/marketlists/${id}/revision`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }),

  // Notes
  getMarketlistNotes: (id) => fetchApi(`/marketlists/${id}/notes`),
  updateMarketlistNotes: (id, note) =>
    fetchApi(`/marketlists/${id}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ note })
    }),

  // Receiving (Surat Jalan Digital)
  getReceiptsByMarketlist: (marketlistId) => fetchApi(`/marketlists/${marketlistId}/receipts`),
  getReceiptById: (id) => fetchApi(`/receipts/${id}`),

  // Invoices
  getInvoices: (params = '') => fetchApi(`/invoices${params}`),
  getInvoiceById: (id) => fetchApi(`/invoices/${id}`),
  generateInvoice: (marketlistId, options = {}) =>
    fetchApi(`/marketlists/${marketlistId}/invoices/generate`, {
      method: 'POST',
      body: JSON.stringify(options)
    }),
  getInvoicePdfUrl: (id) => {
    const token = getStoredToken();
    return `${API_BASE}/invoices/${id}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // Profit & Loss (Laba Rugi) with OAuth 2
  getProfitLoss: (params = '') => fetchApi(`/finance/profit-loss${params}`),

  // Purchase Transactions (Pencatatan Pembelian ke Supplier)
  getPurchases: (params = '') => fetchApi(`/purchases${params}`),
  getPurchaseById: (id) => fetchApi(`/purchases/${id}`),
  createPurchase: (data) =>
    fetchApi('/purchases', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  // Debt management (Purchases / Supplier)
  getDebts: (params = '') => fetchApi(`/purchases/debts${params}`),
  getPurchasePayments: (id) => fetchApi(`/purchases/${id}/payments`),
  recordDebtPayment: (id, data) =>
    fetchApi(`/purchases/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Kelola Biaya Overhead & Hutang Operasional
  getOverheads: (params = '') => fetchApi(`/overheads${params}`),
  getOverheadSummary: (params = '') => fetchApi(`/overheads/summary${params}`),
  getOverheadDebts: (params = '') => fetchApi(`/overheads/debts${params}`),
  getOverheadById: (id) => fetchApi(`/overheads/${id}`),
  createOverhead: (data) =>
    fetchApi('/overheads', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateOverhead: (id, data) =>
    fetchApi(`/overheads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteOverhead: (id) =>
    fetchApi(`/overheads/${id}`, {
      method: 'DELETE'
    }),
  recordOverheadPayment: (id, data) =>
    fetchApi(`/overheads/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getOverheadPayments: (id) => fetchApi(`/overheads/${id}/payments`),

  // User Management & RBAC
  getUsers: (params = '') => fetchApi(`/users${params}`),
  getUserById: (id) => fetchApi(`/users/${id}`),
  createUser: (data) =>
    fetchApi('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id, data) =>
    fetchApi(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  deleteUser: (id) =>
    fetchApi(`/users/${id}`, {
      method: 'DELETE'
    }),

  // Locations
  getLocations: () => fetchApi('/locations'),

  // Marketlist per-item approval
  approveItems: (id, data) =>
    fetchApi(`/marketlists/${id}/approve-items`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Products & Master Data
  createProduct: (data) =>
    fetchApi('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateProduct: (id, data) =>
    fetchApi(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  deleteProduct: (id) =>
    fetchApi(`/products/${id}`, {
      method: 'DELETE'
    }),
  getUnits: () => fetchApi('/products/units'),
  getCategories: () => fetchApi('/products/categories')
};

