const mongoose = require('mongoose');

const PurchaseItemSchema = new mongoose.Schema(
  {
    purchase_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true
    },
    marketlist_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketlistItem',
      required: true
    },
    actual_qty: {
      type: Number,
      required: true
    },
    actual_unit_price: {
      type: Number,
      required: true
    },
    actual_subtotal: {
      type: Number,
      required: true
    },
    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseItem', PurchaseItemSchema);
