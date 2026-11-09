const mongoose = require('mongoose');

const CashTransactionSchema = new mongoose.Schema(
  {
    transaction_number: {
      type: String,
      unique: true,
      required: true
    },
    // 'in' (Uang Masuk), 'withdrawal' (Tarik Tunai dari Bank ke Kas), 'out' (Pengeluaran Kas Manual)
    type: {
      type: String,
      enum: ['in', 'withdrawal', 'out'],
      required: true,
      index: true
    },
    // Sumber akun: cash (Kas Tunai) | bank (Rekening Bank)
    source_account: {
      type: String,
      enum: ['cash', 'bank'],
      default: 'cash'
    },
    // Akun tujuan (untuk 'in' atau 'withdrawal'): cash | bank
    to_account: {
      type: String,
      enum: ['cash', 'bank', null],
      default: null
    },
    amount: {
      type: Number,
      required: [true, 'Nominal transaksi wajib diisi'],
      min: [1, 'Nominal harus lebih dari 0']
    },
    // Kategori: modal, penjualan_pos, transfer_masuk, tarik_tunai, operasional_manual, lainnya
    category: {
      type: String,
      default: 'lainnya'
    },
    description: {
      type: String,
      required: [true, 'Keterangan transaksi wajib diisi'],
      trim: true
    },
    reference_number: {
      type: String,
      default: '' // No. referensi transfer / resi ATM / bukti kuitansi
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    attachment: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CashTransaction', CashTransactionSchema);

