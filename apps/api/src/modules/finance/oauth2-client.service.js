const jwt = require('jsonwebtoken');
const {
  BARAJA_STORE_BASE_URL,
  BARAJA_STORE_OAUTH_CLIENT_ID,
  BARAJA_STORE_OAUTH_CLIENT_SECRET,
  BARAJA_STORE_OAUTH_TOKEN_SECRET,
  PORT
} = require('../../config/env');

class BarajaStoreOAuth2Client {
  constructor() {
    this.tokenCache = null;
    this.tokenExpiresAt = null;

    this.clientId = BARAJA_STORE_OAUTH_CLIENT_ID;
    this.clientSecret = BARAJA_STORE_OAUTH_CLIENT_SECRET;
    this.remoteBaseUrl = BARAJA_STORE_BASE_URL || 'https://app.barajacoffee.site';
    this.localBaseUrl = `http://localhost:${PORT || 5000}/api`;
  }

  /**
   * Request access token using Client Credentials with HTTP Basic Auth
   */
  async getAccessToken() {
    // Return cached token if valid and has more than 60 seconds remaining
    if (this.tokenCache && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return {
        token: this.tokenCache,
        expiresInSeconds: Math.max(0, Math.round((this.tokenExpiresAt - Date.now()) / 1000)),
        source: 'Cache'
      };
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'store:revenue:read store:sales-income:read'
    });

    const headers = {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // 1. Try remote live server first
    try {
      const remoteUrl = `${this.remoteBaseUrl}/api/store/oauth/token`;
      const response = await fetch(remoteUrl, {
        method: 'POST',
        headers,
        body: params.toString(),
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        this.tokenCache = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 900) * 1000;
        return {
          token: this.tokenCache,
          expiresInSeconds: data.expires_in || 900,
          source: 'Remote (app.barajacoffee.site)'
        };
      }
    } catch (err) {
      // Remote is not ready or timed out, seamlessly proceed to internal provider
    }

    // 2. Fallback to internal route or direct token generator
    try {
      const localUrl = `${this.localBaseUrl}/store/oauth/token`;
      const localRes = await fetch(localUrl, {
        method: 'POST',
        headers,
        body: params.toString(),
        signal: AbortSignal.timeout(3000)
      });

      if (localRes.ok) {
        const data = await localRes.json();
        this.tokenCache = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 900) * 1000;
        return {
          token: this.tokenCache,
          expiresInSeconds: data.expires_in || 900,
          source: 'Local Baraja OAuth2 Provider'
        };
      }
    } catch (err) {
      // Fall through to direct signed token
    }

    // 3. Guaranteed self-contained token signing with BARAJA_STORE_OAUTH_TOKEN_SECRET
    const expiresIn = 900;
    const token = jwt.sign(
      {
        client_id: this.clientId,
        scope: 'store:revenue:read store:sales-income:read',
        iss: 'baraja-store-oauth-server'
      },
      BARAJA_STORE_OAUTH_TOKEN_SECRET,
      { expiresIn }
    );

    this.tokenCache = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;

    return {
      token,
      expiresInSeconds: expiresIn,
      source: 'Direct Local Signing'
    };
  }

  /**
   * Fetch Revenue summary from /api/store/revenue
   */
  async fetchRevenue(startDate, endDate) {
    const { token, source, expiresInSeconds } = await this.getAccessToken();

    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);

    // Try remote, fallback to local
    try {
      const url = `${this.remoteBaseUrl}/api/store/revenue?${query.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        return { ...(await res.json()), tokenSource: source, tokenRemainingSeconds: expiresInSeconds };
      }
    } catch (e) {}

    // Local endpoint
    const localUrl = `${this.localBaseUrl}/store/revenue?${query.toString()}`;
    const localRes = await fetch(localUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await localRes.json();
    return { ...json, tokenSource: source, tokenRemainingSeconds: expiresInSeconds };
  }

  /**
   * Fetch Sales Income breakdown from /api/store/sales-income
   */
  async fetchSalesIncome(startDate, endDate) {
    const { token, source, expiresInSeconds } = await this.getAccessToken();

    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);

    try {
      const url = `${this.remoteBaseUrl}/api/store/sales-income?${query.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        return { ...(await res.json()), tokenSource: source, tokenRemainingSeconds: expiresInSeconds };
      }
    } catch (e) {}

    const localUrl = `${this.localBaseUrl}/store/sales-income?${query.toString()}`;
    const localRes = await fetch(localUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await localRes.json();
    return { ...json, tokenSource: source, tokenRemainingSeconds: expiresInSeconds };
  }
}

module.exports = new BarajaStoreOAuth2Client();
