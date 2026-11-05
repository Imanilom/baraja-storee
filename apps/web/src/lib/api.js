const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('baraja_access_token');
  }
  return null;
};

export const setStoredUser = (user, token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('baraja_access_token', token);
    localStorage.setItem('baraja_user', JSON.stringify(user));
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
  // Auth
  login: (email, password) =>
    fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  getMe: () => fetchApi('/auth/me'),

  // Dashboard
  getDashboardMetrics: () => fetchApi('/dashboard'),

  // Master Data
  getProducts: () => fetchApi('/products'),
  getSuppliers: () => fetchApi('/suppliers'),

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
  getInvoicePdfUrl: (id) => `${API_BASE}/invoices/${id}/pdf`,

  // Profit & Loss (Laba Rugi) with OAuth 2
  getProfitLoss: (params = '') => fetchApi(`/finance/profit-loss${params}`)
};

