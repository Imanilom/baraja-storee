const mongoose = require('mongoose');

const overheadPaymentSchema = new mongoose.Schema(
  {
    overhead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Overhead',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Jumlah pembayaran wajib diisi'],
      min: [1, 'Jumlah pembayaran minimal Rp 1']
    },
    payment_method: {
      type: String,
      enum: ['cash', 'transfer'],
      default: 'transfer'
    },
    paid_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    reference_number: {
      type: String,
      trim: true,
      default: ''
    },
    attachment: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    recorded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const OverheadPayment =
  mongoose.models.OverheadPayment || mongoose.model('OverheadPayment', overheadPaymentSchema);

module.exports = OverheadPayment;
