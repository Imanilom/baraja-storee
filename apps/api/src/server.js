const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');

const server = http.createServer(app);

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`[Purchasing API] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`[Purchasing API] Health check available at http://localhost:${PORT}/health`);
  });
};

startServer();

