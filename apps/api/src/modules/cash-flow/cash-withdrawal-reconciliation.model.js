const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema(
  {
    source_type: {
      type: String,
      enum: ['overhead', 'overhead_payment'],
      required: true
    },
    source_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const cashWithdrawalReconciliationSchema = new mongoose.Schema(
  {
    fingerprint: {
      type: String,
      required: true,
      unique: true
    },
    row_number: Number,
    statement_date: Date,
    statement_description: {
      type: String,
      required: true
    },
    statement_reference: {
      type: String,
      default: ''
    },
    statement_amount: {
      type: Number,
      required: true,
      min: 1
    },
    cash_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashTransaction',
      required: true,
      unique: true
    },
    allocations: {
      type: [allocationSchema],
      default: []
    },
    allocated_amount: {
      type: Number,
      required: true,
      min: 0
    },
    matched_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

cashWithdrawalReconciliationSchema.index({ statement_date: -1, statement_amount: 1 });
cashWithdrawalReconciliationSchema.index(
  { 'allocations.source_type': 1, 'allocations.source_id': 1 },
  {
    unique: true,
    partialFilterExpression: { 'allocations.0': { $exists: true } }
  }
);

module.exports = mongoose.models.CashWithdrawalReconciliation ||
  mongoose.model('CashWithdrawalReconciliation', cashWithdrawalReconciliationSchema);
