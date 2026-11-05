const Marketlist = require('../marketlists/marketlist.model');
const Invoice = require('../invoices/invoice.model');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const ActivityLog = require('../audit/activity-log.model');
const { MARKETLIST_STATUS } = require('@purchasing/constants');

class DashboardService {
  async getDashboardMetrics() {
    const [
      totalMarketlists,
      pendingApprovals,
      approvedCount,
      receivingCount,
      completedCount,
      totalInvoices,
      recentLogs
    ] = await Promise.all([
      Marketlist.countDocuments(),
      Marketlist.countDocuments({ status: MARKETLIST_STATUS.SUBMITTED }),
      Marketlist.countDocuments({ status: MARKETLIST_STATUS.APPROVED }),
      Marketlist.countDocuments({
        status: { $in: [MARKETLIST_STATUS.IN_PROGRESS, MARKETLIST_STATUS.PARTIALLY_RECEIVED] }
      }),
      Marketlist.countDocuments({ status: MARKETLIST_STATUS.COMPLETED }),
      Invoice.countDocuments(),
      ActivityLog.find().sort({ created_at: -1 }).limit(10).populate('performed_by', 'name email role')
    ]);

    const invoiceStats = await Invoice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$grand_total' }
        }
      }
    ]);

    return {
      marketlists: {
        total: totalMarketlists,
        pending_approval: pendingApprovals,
        approved: approvedCount,
        in_receiving: receivingCount,
        completed: completedCount
      },
      invoices: {
        total: totalInvoices,
        by_status: invoiceStats
      },
      recent_activity: recentLogs
    };
  }
}

module.exports = new DashboardService();
