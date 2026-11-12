const mongoose = require('mongoose');

const WasteSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    product_name: { type: String, required: true },
    unit_name: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit_purchase_price: { type: Number, required: true, min: 0 },
    total_cost: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
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

module.exports = mongoose.model('Waste', WasteSchema);
