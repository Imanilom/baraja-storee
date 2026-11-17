const mongoose = require('mongoose');

const WasteSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    marketlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Marketlist',
      default: null
    },
    marketlist_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketlistItem',
      default: null
    },
    goods_receipt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      default: null
    },
    location_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null
    },
    product_name: { type: String, required: true },
    unit_name: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit_purchase_price: { type: Number, required: true, min: 0 },
    total_cost: { type: Number, required: true, min: 0 },
    stage: {
      type: String,
      enum: ['received', 'processing', 'finished_product', 'spoiled', 'other'],
      default: 'other'
    },
    reason: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    integration_status: {
      type: String,
      enum: ['included_in_receipt', 'receipt_sync_pending', 'sync_pending', 'synced', 'sync_failed']
    },
    integration_movement_id: { type: String, default: null },
    integration_stock_balance: { type: Number, min: 0 },
    integration_last_sync_at: Date,
    integration_error: { type: String, default: '' },
    wasted_at: { type: Date, required: true, default: Date.now },
    recorded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

WasteSchema.index({ wasted_at: -1 });
WasteSchema.index({ product_id: 1, wasted_at: -1 });
WasteSchema.index({ marketlist_id: 1, wasted_at: -1 });
WasteSchema.index({ goods_receipt_id: 1, marketlist_item_id: 1 });
WasteSchema.index({ integration_status: 1, wasted_at: -1 });

module.exports = mongoose.model('Waste', WasteSchema);
