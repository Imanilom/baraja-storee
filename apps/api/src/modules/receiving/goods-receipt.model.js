const mongoose = require('mongoose');
const { GOODS_RECEIPT_STATUS } = require('@purchasing/constants');

const GoodsReceiptSchema = new mongoose.Schema(
  {
    receipt_number: {
      type: String,
      required: true,
      unique: true
    },
    client_request_id: {
      type: String,
      sparse: true,
      unique: true // Prevents duplicate offline submissions
    },
    marketlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Marketlist',
      required: true
    },
    received_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    received_at: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: Object.values(GOODS_RECEIPT_STATUS),
      default: GOODS_RECEIPT_STATUS.SUBMITTED
    },
    general_condition: String,
    attachments: [
      {
        url: String,
        type: { type: String }
      }
    ]
  },
  { timestamps: true }
);

GoodsReceiptSchema.index({ marketlist_id: 1, received_at: -1 });

module.exports = mongoose.model('GoodsReceipt', GoodsReceiptSchema);

