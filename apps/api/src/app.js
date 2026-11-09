const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
require('./database/registerModels');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const productRoutes = require('./modules/products/product.routes');
const supplierRoutes = require('./modules/suppliers/supplier.routes');
const marketlistRoutes = require('./modules/marketlists/marketlist.routes');
const { receivingRouter, marketlistReceiptRouter } = require('./modules/receiving/receiving.routes');
const { invoiceRouter, marketlistInvoiceRouter } = require('./modules/invoices/invoice.routes');
const priceRoutes = require('./modules/prices/prices.routes');
const purchaseRoutes = require('./modules/purchases/purchase.routes');
const overheadRoutes = require('./modules/overheads/overhead.routes');
const kpiRoutes = require('./modules/kpi/kpi.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const financeRoutes = require('./modules/finance/profit-loss.routes');
const cashFlowRoutes = require('./modules/cash-flow/cash-flow.routes');
const locationRoutes = require('./modules/locations/location.routes');
const externalPosRoutes = require('./modules/external-pos/external-pos.routes');

const app = express();

// Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (Base: /api/v1)
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/marketlists', marketlistRoutes);
apiRouter.use('/marketlists/:marketlistId/receipts', marketlistReceiptRouter);
apiRouter.use('/marketlists/:marketlistId/invoices', marketlistInvoiceRouter);
apiRouter.use('/receipts', receivingRouter);
apiRouter.use('/receiving', receivingRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/purchases', purchaseRoutes);
apiRouter.use('/overheads', overheadRoutes);
apiRouter.use('/prices', priceRoutes);
apiRouter.use('/locations', locationRoutes);
apiRouter.use('/kpi', kpiRoutes);
apiRouter.use('/finance', financeRoutes);
apiRouter.use('/cash-flow', cashFlowRoutes);
apiRouter.use('/', externalPosRoutes); // provides /oauth2/token and /external-pos/sales

app.use('/api/v1', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use(errorHandler);

module.exports = app;

