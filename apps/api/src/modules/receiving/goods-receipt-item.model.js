const mongoose = require('mongoose');
const { ITEM_CONDITION, RECEIVING_STATUS } = require('@purchasing/constants');

const GoodsReceiptItemSchema = new mongoose.Schema(
  {
    receipt_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      required: true
    },
    marketlist_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketlistItem',
      required: true
    },
    ordered_qty: {
      type: Number,
      required: true
    },
    received_qty: {
      type: Number,
      required: true,
      min: 0
    },
    accepted_qty: {
      type: Number,
      default: 0,
      min: 0
    },
    rejected_qty: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: Object.values(RECEIVING_STATUS),
      default: RECEIVING_STATUS.PENDING
    },
    is_checked: {
      type: Boolean,
      default: false
    },
    condition: {
      type: String,
      enum: Object.values(ITEM_CONDITION),
      default: ITEM_CONDITION.GOOD
    },
    item_note: String,
    evidence: [
      {
        url: String,
        uploaded_at: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

GoodsReceiptItemSchema.index({ receipt_id: 1, marketlist_item_id: 1 });

module.exports = mongoose.model('GoodsReceiptItem', GoodsReceiptItemSchema);
