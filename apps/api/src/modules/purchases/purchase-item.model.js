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
      default: null
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    product_name: {
      type: String,
      default: ''
    },
    unit_name: {
      type: String,
      default: ''
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
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseItem', PurchaseItemSchema);
