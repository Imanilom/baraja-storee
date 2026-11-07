const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://rcooker00_db_user:0Mkh0swiymyFu2Ti@baraja-store.d9rjswq.mongodb.net/purchasing_management?retryWrites=true&w=majority',
  JWT_SECRET: process.env.JWT_SECRET || 'purchasing_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'purchasing_refresh_secret_key_2026',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  // Baraja Coffee Store OAuth 2.0 configuration
  BARAJA_STORE_BASE_URL: process.env.BARAJA_STORE_BASE_URL || 'https://app.barajacoffee.site',
  BARAJA_STORE_OAUTH_CLIENT_ID: process.env.BARAJA_STORE_OAUTH_CLIENT_ID || 'baraja-store-client-id',
  BARAJA_STORE_OAUTH_CLIENT_SECRET: process.env.BARAJA_STORE_OAUTH_CLIENT_SECRET || 'JiLcYhCVxdkHK4V/6gFC7gUhsxi8h7pXkbwXpSD0zCA=',
  BARAJA_STORE_OAUTH_TOKEN_SECRET: process.env.BARAJA_STORE_OAUTH_TOKEN_SECRET || 'j9lUz73prZX9bq0L3qNBIojiM/RtR15jkw7ImWMU/Jc='
};

