const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    contact_person: String,
    phone: String,
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    address: String,
    bank_account: {
      bank_name: String,
      account_number: String,
      account_holder: String
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', SupplierSchema);

