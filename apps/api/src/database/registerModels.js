/**
 * Central registry to ensure all Mongoose models are registered
 * before any queries or population references (ref) are executed.
 */
require('../modules/locations/location.model');
require('../modules/users/user.model');
require('../modules/products/unit.model');
require('../modules/products/category.model');
require('../modules/products/product.model');
require('../modules/suppliers/supplier.model');
require('../modules/marketlists/marketlist.model');
require('../modules/marketlists/marketlist-item.model');
require('../modules/approvals/marketlist-approval.model');
require('../modules/notes/marketlist-note.model');
require('../modules/receiving/goods-receipt.model');
require('../modules/receiving/goods-receipt-item.model');
require('../modules/invoices/invoice.model');
require('../modules/prices/product-price.model');
require('../modules/kpi/kpi-record.model');
require('../modules/audit/activity-log.model');
require('../modules/purchases/purchase.model');
require('../modules/purchases/purchase-item.model');
require('../modules/purchases/debt-payment.model');
require('../modules/overheads/overhead.model');
require('../modules/overheads/overhead-payment.model');
require('../modules/waste/waste.model');
