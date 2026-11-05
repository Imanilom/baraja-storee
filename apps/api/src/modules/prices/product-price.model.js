const mongoose = require('mongoose');
const { PRICE_SOURCES } = require('@purchasing/constants');

const ProductPriceSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    source: {
      type: String,
      enum: Object.values(PRICE_SOURCES),
      default: PRICE_SOURCES.MARKETLIST
    },
    reference_id: mongoose.Schema.Types.ObjectId,
    recorded_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

ProductPriceSchema.index({ product_id: 1, supplier_id: 1, recorded_at: -1 });

module.exports = mongoose.model('ProductPrice', ProductPriceSchema);

