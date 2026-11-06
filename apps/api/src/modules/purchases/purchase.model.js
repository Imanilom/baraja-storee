const mongoose = require('mongoose');
const { PURCHASE_STATUS } = require('@purchasing/constants');

const PurchaseSchema = new mongoose.Schema(
  {
    purchase_number: {
      type: String,
      unique: true,
      required: true
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
    invoice_ref: {
      type: String,
      default: ''
    },
    payment_method: {
      type: String,
      enum: ['cash', 'transfer', 'tempo'],
      default: 'cash'
    },
    purchased_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    purchased_at: {
      type: Date,
      default: Date.now
    },
    total_actual: {
      type: Number,
      required: true
    },
    receipt_attachment: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: Object.values(PURCHASE_STATUS),
      default: PURCHASE_STATUS.VERIFIED
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', PurchaseSchema);
