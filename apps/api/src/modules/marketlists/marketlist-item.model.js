const mongoose = require('mongoose');

const MarketlistItemSchema = new mongoose.Schema(
  {
    marketlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Marketlist',
      required: true
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    product_snapshot: {
      name: String,
      sku: String,
      specification: String,
      unit_name: String
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    requested_qty: {
      type: Number,
      required: true,
      min: 0.000001
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true
    },
    notes: String,
    version: {
      type: Number,
      default: 1
    }
  },
  { timestamps: true }
);

MarketlistItemSchema.index({ marketlist_id: 1, product_id: 1 });
MarketlistItemSchema.index({ marketlist_id: 1, supplier_id: 1 });

module.exports = mongoose.model('MarketlistItem', MarketlistItemSchema);

