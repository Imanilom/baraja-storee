const KpiRecord = require('./kpi-record.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');

class KpiService {
  async calculateMarketlistKpi(marketlistId, adminUserId = null, adminEval = {}) {
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) throw new Error('Marketlist not found');

    const mlItems = await MarketlistItem.find({ marketlist_id: marketlistId });
    const receipts = await GoodsReceipt.find({ marketlist_id: marketlistId });
    const receiptIds = receipts.map((r) => r._id);
    const receiptItems = await GoodsReceiptItem.find({ receipt_id: { $in: receiptIds } });

    // Calculate accuracy & fulfillment
    let totalRequested = 0;
    let totalAccepted = 0;
    let completedItemCount = 0;

    const acceptedByItem = new Map();
    receiptItems.forEach((ri) => {
      const k = ri.marketlist_item_id.toString();
      acceptedByItem.set(k, (acceptedByItem.get(k) || 0) + (ri.accepted_qty || 0));
    });

    mlItems.forEach((item) => {
      totalRequested += item.requested_qty;
      const acc = acceptedByItem.get(item._id.toString()) || 0;
      totalAccepted += acc;
      if (acc >= item.requested_qty) {
        completedItemCount++;
      }
    });

    const receiving_accuracy = totalRequested > 0 ? Number(((totalAccepted / totalRequested) * 100).toFixed(1)) : 0;
    const item_fulfillment = mlItems.length > 0 ? Number(((completedItemCount / mlItems.length) * 100).toFixed(1)) : 0;

    // On time check: latest receipt date <= required_date
    let on_time_receiving = 100;
    if (receipts.length > 0 && marketlist.required_date) {
      const latestReceipt = Math.max(...receipts.map((r) => new Date(r.received_at).getTime()));
      if (latestReceipt > new Date(marketlist.required_date).getTime()) {
        on_time_receiving = 75; // slight delay
      }
    }

    const metrics = {
      receiving_accuracy,
      item_fulfillment,
      on_time_receiving,
      price_variance: 0,
      document_completeness: receipts.length > 0 ? 100 : 0
    };

    const final_score = Number(
      ((receiving_accuracy * 0.4 + item_fulfillment * 0.3 + on_time_receiving * 0.3)).toFixed(1)
    );

    const kpiRecord = await KpiRecord.findOneAndUpdate(
      { marketlist_id: marketlistId },
      {
        marketlist_id: marketlistId,
        user_id: marketlist.created_by,
        metrics,
        admin_evaluation: adminUserId
          ? {
            score: adminEval.score,
            comment: adminEval.comment,
            evaluated_by: adminUserId,
            evaluated_at: new Date()
          }
          : undefined,
        final_score,
        calculated_at: new Date()
      },
      { upsert: true, new: true }
    );

    return kpiRecord;
  }

  async getKpiSummary() {
    const records = await KpiRecord.find().populate('user_id', 'name email role').populate('marketlist_id', 'marketlist_number');
    const total = records.length;
    if (total === 0) {
      return {
        totalEvaluated: 0,
        averageAccuracy: 0,
        averageFulfillment: 0,
        averageScore: 0,
        records: []
      };
    }

    const avgAccuracy = records.reduce((acc, r) => acc + (r.metrics?.receiving_accuracy || 0), 0) / total;
    const avgFulfillment = records.reduce((acc, r) => acc + (r.metrics?.item_fulfillment || 0), 0) / total;
    const avgScore = records.reduce((acc, r) => acc + (r.final_score || 0), 0) / total;

    return {
      totalEvaluated: total,
      averageAccuracy: Number(avgAccuracy.toFixed(1)),
      averageFulfillment: Number(avgFulfillment.toFixed(1)),
      averageScore: Number(avgScore.toFixed(1)),
      records
    };
  }
}

module.exports = new KpiService();

