const mongoose = require('mongoose');

const PurchaseReconciliationSchema = new mongoose.Schema(
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
    candidate_keys: [{
      type: String,
      required: true
    }],
    purchase_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase'
    }],
    debt_payment_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DebtPayment'
    }],
    supplier_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    }],
    beneficiary_name: {
      type: String,
      trim: true,
      default: ''
    },
    normalized_beneficiary: {
      type: String,
      default: '',
      index: true
    },
    match_type: {
      type: String,
      enum: ['automatic', 'manual'],
      required: true
    },
    matched_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

PurchaseReconciliationSchema.index({ statement_date: -1, statement_amount: 1 });
PurchaseReconciliationSchema.index({ supplier_ids: 1, statement_date: -1 });

module.exports = mongoose.models.PurchaseReconciliation ||
  mongoose.model('PurchaseReconciliation', PurchaseReconciliationSchema);
