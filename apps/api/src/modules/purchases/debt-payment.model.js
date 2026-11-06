const mongoose = require('mongoose');

// Catatan pembayaran hutang (cicilan/pelunasan)
const DebtPaymentSchema = new mongoose.Schema(
  {
    purchase_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Jumlah pembayaran harus lebih dari 0']
    },
    payment_method: {
      type: String,
      enum: ['cash', 'transfer'],
      default: 'transfer'
    },
    paid_at: {
      type: Date,
      default: Date.now
    },
    reference_number: {
      type: String,
      default: '' // No. bukti transfer / kuitansi
    },
    attachment: {
      type: String,
      default: '' // URL bukti pembayaran
    },
    notes: {
      type: String,
      default: ''
    },
    recorded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DebtPayment', DebtPaymentSchema);

