const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/env');

// OAuth 2.0 Token Endpoint (RFC 6749 client_credentials)
router.post('/token', (req, res) => {
  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;

  // Support HTTP Basic Auth header: Authorization: Basic base64(client_id:client_secret)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    const creds = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    clientId = creds[0];
    clientSecret = creds[1];
  }

  const validClientId = process.env.EXTERNAL_OAUTH2_CLIENT_ID || 'baraja_pos_client';
  const validClientSecret = process.env.EXTERNAL_OAUTH2_CLIENT_SECRET || 'baraja_pos_secret_2026';

  if (clientId !== validClientId || clientSecret !== validClientSecret) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication failed (invalid client ID or secret)'
    });
  }

  const token = jwt.sign(
    {
      client_id: clientId,
      scope: req.body.scope || 'read:sales read:revenue',
      iss: 'baraja_pos_oauth2_server'
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  return res.status(200).json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 7200,
    scope: req.body.scope || 'read:sales read:revenue'
  });
});

// Middleware to protect external sales API with OAuth 2 Bearer Token
const verifyOAuth2Bearer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'OAuth 2.0 Bearer token required'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.oauthClient = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'The access token is invalid or has expired'
    });
  }
};

// External Sales & Revenue API Route
router.get('/external-pos/sales', verifyOAuth2Bearer, (req, res) => {
  const { period = 'monthly', startDate, endDate } = req.query;

  // Real-time or simulated store revenue data from POS
  const salesData = {
    source: 'Baraja POS External Cloud API (OAuth 2 Protected)',
    client_id: req.oauthClient.client_id,
    period,
    total_sales: 24750000,
    total_transactions: 418,
    gross_sales: 25200000,
    discounts: 450000,
    sales_breakdown: [
      { category: 'Bahan Pokok & Sembako', revenue: 12500000, qty_sold: 520 },
      { category: 'Daging, Unggas & Frozen', revenue: 8250000, qty_sold: 160 },
      { category: 'Bumbu Dapur & Sayur', revenue: 4000000, qty_sold: 110 }
    ],
    daily_trends: [
      { date: '2026-11-01', revenue: 3800000 },
      { date: '2026-11-02', revenue: 4200000 },
      { date: '2026-11-03', revenue: 4100000 },
      { date: '2026-11-04', revenue: 5900000 },
      { date: '2026-11-05', revenue: 6750000 }
    ]
  };

  return res.status(200).json({
    success: true,
    data: salesData
  });
});

module.exports = router;

