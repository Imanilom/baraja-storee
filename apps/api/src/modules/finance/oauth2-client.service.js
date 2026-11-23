const {
  BARAJA_STORE_BASE_URL,
  BARAJA_STORE_OAUTH_CLIENT_ID,
  BARAJA_STORE_OAUTH_CLIENT_SECRET
} = require('../../config/env');

const REPORT_TIMEOUT_MS = 10000;

function toDateOnly(value, fieldName) {
  if (!value) return null;
  const date = value instanceof Date ? value.toISOString() : String(value);
  const match = date.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (!match || Number.isNaN(Date.parse(date))) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return match[1];
}

async function readJsonResponse(response, operation) {
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error(`${operation} returned invalid JSON: ${error.message}`);
  }

  if (!response.ok) {
    const message = result?.error_description || result?.message || result?.error;
    throw new Error(
      `${operation} failed (HTTP ${response.status})${message ? `: ${message}` : ''}`
    );
  }
  return result;
}

class BarajaStoreOAuth2Client {
  constructor() {
    this.tokenCache = null;
    this.tokenExpiresAt = null;
    this.clientId = BARAJA_STORE_OAUTH_CLIENT_ID;
    this.clientSecret = BARAJA_STORE_OAUTH_CLIENT_SECRET;
    this.remoteBaseUrl = BARAJA_STORE_BASE_URL;
  }

  async getAccessToken() {
    if (this.tokenCache && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return {
        token: this.tokenCache,
        expiresInSeconds: Math.max(0, Math.round((this.tokenExpiresAt - Date.now()) / 1000)),
        source: 'Baraja Coffee OAuth 2.0'
      };
    }

    if (!this.remoteBaseUrl || !this.clientId || !this.clientSecret) {
      throw new Error('Konfigurasi OAuth Baraja Coffee belum lengkap.');
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'store:revenue:read store:sales-income:read'
    });
    const response = await fetch(
      `${this.remoteBaseUrl.replace(/\/+$/, '')}/api/store/oauth/token`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${basicAuth}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: params.toString(),
        signal: AbortSignal.timeout(REPORT_TIMEOUT_MS)
      }
    );
    const result = await readJsonResponse(response, 'Baraja Coffee OAuth token request');
    if (typeof result.access_token !== 'string' || !result.access_token) {
      throw new Error('Baraja Coffee OAuth response tidak berisi access token.');
    }

    const expiresInSeconds = Number(result.expires_in) || 900;
    this.tokenCache = result.access_token;
    this.tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    return {
      token: this.tokenCache,
      expiresInSeconds,
      source: 'Baraja Coffee OAuth 2.0'
    };
  }

  async requestReport(path, startDate, endDate) {
    const { token, source, expiresInSeconds } = await this.getAccessToken();
    const query = new URLSearchParams();
    const formattedStartDate = toDateOnly(startDate, 'startDate');
    const formattedEndDate = toDateOnly(endDate, 'endDate');
    if (formattedStartDate) query.set('startDate', formattedStartDate);
    if (formattedEndDate) query.set('endDate', formattedEndDate);

    const response = await fetch(
      `${this.remoteBaseUrl.replace(/\/+$/, '')}/api/store/${path}?${query.toString()}`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REPORT_TIMEOUT_MS)
      }
    );
    const result = await readJsonResponse(response, `Baraja Coffee ${path} report`);
    if (result.success === false) {
      throw new Error(result.message || `Baraja Coffee ${path} report failed.`);
    }

    const data = result.data || result;
    return {
      ...data,
      tokenSource: source,
      tokenRemainingSeconds: expiresInSeconds
    };
  }

  async fetchRevenue(startDate, endDate) {
    return this.requestReport('revenue', startDate, endDate);
  }

  async fetchSalesIncome(startDate, endDate) {
    return this.requestReport('sales-income', startDate, endDate);
  }

  async fetchExternalSalesData(period, startDate, endDate) {
    const revenueData = await this.fetchRevenue(startDate, endDate);
    const salesIncomeData = await this.fetchSalesIncome(startDate, endDate);
    const totalSales = Number(revenueData.totalRevenue);
    const totalIncome = Number(salesIncomeData.totalIncome);
    if (!Number.isFinite(totalSales) || !Number.isFinite(totalIncome)) {
      throw new Error('Baraja Coffee tidak mengembalikan total pendapatan yang valid.');
    }

    const dailyTrends = Array.isArray(revenueData.daily)
      ? revenueData.daily.map((day) => ({
        date: day.date,
        revenue: Number(day.totalRevenue ?? day.revenue),
        transactions: Number(day.orderCount ?? day.completedOrders ?? 0)
      }))
      : [];
    if (dailyTrends.some((day) => !day.date || !Number.isFinite(day.revenue) ||
      !Number.isFinite(day.transactions))) {
      throw new Error('Baraja Coffee mengembalikan rincian pendapatan harian yang tidak valid.');
    }

    const paymentBreakdown = Array.isArray(salesIncomeData.byPaymentMethod)
      ? salesIncomeData.byPaymentMethod.map((item) => ({
        method: item.method || 'Lain-lain',
        total_income: Number(item.totalIncome),
        payment_count: Number(item.paymentCount)
      }))
      : [];
    if (paymentBreakdown.some((item) => !Number.isFinite(item.total_income) ||
      !Number.isFinite(item.payment_count))) {
      throw new Error('Baraja Coffee mengembalikan rincian metode pembayaran yang tidak valid.');
    }

    return {
      source: revenueData.tokenSource || 'Baraja Coffee OAuth 2.0 API',
      total_sales: totalSales,
      total_transactions: Number(revenueData.orderCount ?? revenueData.totalCompletedOrders ?? 0),
      total_payment_income: totalIncome,
      payment_breakdown: paymentBreakdown,
      sales_breakdown: [],
      daily_trends: dailyTrends
    };
  }
}

module.exports = new BarajaStoreOAuth2Client();
