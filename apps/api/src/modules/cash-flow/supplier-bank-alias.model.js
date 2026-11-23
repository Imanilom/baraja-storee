const mongoose = require('mongoose');

const SupplierBankAliasSchema = new mongoose.Schema(
  {
    alias: {
      type: String,
      required: true,
      trim: true
    },
    normalized_alias: {
      type: String,
      required: true,
      unique: true
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true
    },
    usage_count: {
      type: Number,
      default: 1,
      min: 1
    },
    last_used_at: {
      type: Date,
      default: Date.now
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.SupplierBankAlias ||
  mongoose.model('SupplierBankAlias', SupplierBankAliasSchema);
