const mongoose = require('mongoose');
const { INVOICE_STATUS } = require('@purchasing/constants');

const InvoiceItemEmbeddedSchema = new mongoose.Schema(
  {
    marketlist_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketlistItem'
    },
    product_name: {
      type: String,
      required: true
    },
    sku: String,
    quantity: {
      type: Number,
      required: true
    },
    unit: String,
    unit_price: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoice_number: {
      type: String,
      required: true,
      unique: true
    },
    marketlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Marketlist',
      required: true
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    marketlist_version: {
      type: Number,
      required: true
    },
    invoice_date: {
      type: Date,
      default: Date.now
    },
    items: [InvoiceItemEmbeddedSchema],
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    grand_total: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.GENERATED
    },
    pdf_url: String,
    generated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    generated_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

InvoiceSchema.index({ marketlist_id: 1, supplier_id: 1, marketlist_version: 1 }, { unique: true });
InvoiceSchema.index({ status: 1, invoice_date: -1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);

