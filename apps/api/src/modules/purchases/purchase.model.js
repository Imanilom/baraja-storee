const mongoose = require('mongoose');
const { PURCHASE_STATUS, PAYMENT_STATUS } = require('@purchasing/constants');

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
    // cash | transfer | tempo (hutang/kredit)
    payment_method: {
      type: String,
      enum: ['cash', 'transfer', 'tempo'],
      default: 'cash'
    },
    // Sumber dana / akun kas pengeluaran: cash (Kas Tunai) | bank (Rekening Bank)
    payment_source: {
      type: String,
      enum: ['cash', 'bank'],
      default: 'cash'
    },
    // Status pembayaran: paid = lunas, unpaid = hutang belum bayar, partial = bayar sebagian, overdue = jatuh tempo
    payment_status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PAID
    },
    // Tanggal jatuh tempo (untuk tempo/hutang)
    due_date: {
      type: Date,
      default: null
    },
    // Total yang sudah dibayar
    amount_paid: {
      type: Number,
      default: 0
    },
    // Sisa hutang (otomatis dihitung: total_actual - amount_paid)
    amount_remaining: {
      type: Number,
      default: 0
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

// Virtual: is_overdue
PurchaseSchema.virtual('is_overdue').get(function () {
  if (!this.due_date) return false;
  if (this.payment_status === 'paid') return false;
  return new Date() > this.due_date;
});

PurchaseSchema.set('toJSON', { virtuals: true });
PurchaseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Purchase', PurchaseSchema);
