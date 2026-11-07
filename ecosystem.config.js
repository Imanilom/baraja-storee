module.exports = {
  apps: [
    {
      name: 'baraja-api',
      cwd: './apps/api',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGODB_URI: 'mongodb+srv://rcooker00_db_user:0Mkh0swiymyFu2Ti@baraja-store.d9rjswq.mongodb.net/purchasing_management?retryWrites=true&w=majority',
        JWT_SECRET: 'purchasing_secret_jwt_key_2026',
        JWT_EXPIRES_IN: '7d',
        REFRESH_TOKEN_SECRET: 'purchasing_refresh_secret_key_2026',
        REFRESH_TOKEN_EXPIRES_IN: '30d',
        BARAJA_STORE_BASE_URL: 'https://app.barajacoffee.site',
        BARAJA_STORE_OAUTH_CLIENT_ID: 'baraja-store-client-id',
        BARAJA_STORE_OAUTH_CLIENT_SECRET: 'JiLcYhCVxdkHK4V/6gFC7gUhsxi8h7pXkbwXpSD0zCA=',
        BARAJA_STORE_OAUTH_TOKEN_SECRET: 'j9lUz73prZX9bq0L3qNBIojiM/RtR15jkw7ImWMU/Jc='
      }
    },
    {
      name: 'baraja-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'https://api.barajastore.my.id/api/v1'
      }
    }
  ]
};

