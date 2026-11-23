const assert = require('node:assert/strict');

const originalEnv = {
  baseUrl: process.env.BARAJA_STORE_BASE_URL,
  clientId: process.env.BARAJA_STORE_OAUTH_CLIENT_ID,
  clientSecret: process.env.BARAJA_STORE_OAUTH_CLIENT_SECRET
};
const originalFetch = global.fetch;

process.env.BARAJA_STORE_BASE_URL = 'https://coffee.test';
process.env.BARAJA_STORE_OAUTH_CLIENT_ID = 'test-client';
process.env.BARAJA_STORE_OAUTH_CLIENT_SECRET = 'test-client-secret';

const oauth2ClientService = require('../src/modules/finance/oauth2-client.service');

function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

async function run() {
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/api/store/oauth/token')) {
      return mockResponse(200, {
        access_token: 'test-access-token',
        expires_in: 900
      });
    }
    if (String(url).includes('/api/store/revenue?')) {
      return mockResponse(200, {
        success: true,
        data: {
          totalRevenue: 120000,
          orderCount: 3,
          daily: [{ date: '2026-11-02', totalRevenue: 120000, orderCount: 3 }]
        }
      });
    }
    if (String(url).includes('/api/store/sales-income?')) {
      return mockResponse(200, {
        success: true,
        data: {
          totalIncome: 115000,
          byPaymentMethod: [
            { method: 'Tunai', totalIncome: 115000, paymentCount: 3 }
          ]
        }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const report = await oauth2ClientService.fetchExternalSalesData(
      'monthly',
      '2026-11-01T00:00:00.000Z',
      '2026-11-30T23:59:59.999Z'
    );

    assert.equal(report.total_sales, 120000);
    assert.equal(report.total_payment_income, 115000);
    assert.deepEqual(report.daily_trends, [
      { date: '2026-11-02', revenue: 120000, transactions: 3 }
    ]);
    assert.deepEqual(report.payment_breakdown, [
      { method: 'Tunai', total_income: 115000, payment_count: 3 }
    ]);
    assert.ok(requests.some(({ url }) =>
      url.includes('startDate=2026-11-01') && url.includes('endDate=2026-11-30')
    ));

    oauth2ClientService.tokenCache = null;
    oauth2ClientService.tokenExpiresAt = null;
    const failedRequests = [];
    global.fetch = async (url) => {
      failedRequests.push(String(url));
      if (String(url).endsWith('/api/store/oauth/token')) {
        return mockResponse(200, { access_token: 'test-access-token', expires_in: 900 });
      }
      return mockResponse(503, { message: 'Upstream unavailable' });
    };
    await assert.rejects(
      oauth2ClientService.fetchExternalSalesData(
        'daily',
        '2026-11-02T00:00:00.000Z',
        '2026-11-02T23:59:59.999Z'
      ),
      /HTTP 503/
    );
    assert.equal(failedRequests.length, 2);

    console.log('Finance OAuth integration checks passed');
  } finally {
    global.fetch = originalFetch;
    oauth2ClientService.tokenCache = null;
    oauth2ClientService.tokenExpiresAt = null;
    if (originalEnv.baseUrl === undefined) delete process.env.BARAJA_STORE_BASE_URL;
    else process.env.BARAJA_STORE_BASE_URL = originalEnv.baseUrl;
    if (originalEnv.clientId === undefined) delete process.env.BARAJA_STORE_OAUTH_CLIENT_ID;
    else process.env.BARAJA_STORE_OAUTH_CLIENT_ID = originalEnv.clientId;
    if (originalEnv.clientSecret === undefined) delete process.env.BARAJA_STORE_OAUTH_CLIENT_SECRET;
    else process.env.BARAJA_STORE_OAUTH_CLIENT_SECRET = originalEnv.clientSecret;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
