const mongoose = require('mongoose');
const { OVERHEAD_CATEGORIES, PAYMENT_STATUS, PAYMENT_METHOD } = require('@purchasing/constants');

const overheadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Nama biaya/keperluan overhead wajib diisi'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Kategori overhead wajib diisi'],
      enum: Object.values(OVERHEAD_CATEGORIES)
    },
    amount: {
      type: Number,
      required: [true, 'Nominal pengeluaran wajib diisi'],
      min: [0, 'Nominal tidak boleh negatif']
    },
    expense_date: {
      type: Date,
      default: Date.now,
      index: true
    },
    payment_method: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.CASH
    },
    payment_status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PAID,
      index: true
    },
    due_date: {
      type: Date,
      default: null,
      index: true
    },
    amount_paid: {
      type: Number,
      default: 0,
      min: 0
    },
    amount_remaining: {
      type: Number,
      default: 0,
      min: 0
    },
    vendor_recipient: {
      type: String,
      trim: true,
      default: '-'
    },
    invoice_ref: {
      type: String,
      trim: true,
      default: ''
    },
    receipt_url: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    branch_name: {
      type: String,
      trim: true,
      default: 'Baraja Coffee - Store Utama'
    },
    recorded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual: is_overdue
overheadSchema.virtual('is_overdue').get(function () {
  if (this.payment_status === PAYMENT_STATUS.PAID) return false;
  if (!this.due_date) return false;
  return new Date(this.due_date) < new Date();
});

// Pre-save hook to ensure amount_remaining & payment_status consistency
overheadSchema.pre('save', function (next) {
  if (this.payment_method !== PAYMENT_METHOD.TEMPO) {
    this.amount_paid = this.amount;
    this.amount_remaining = 0;
    this.payment_status = PAYMENT_STATUS.PAID;
  } else {
    this.amount_remaining = Math.max(0, this.amount - (this.amount_paid || 0));
    if (this.amount_remaining === 0) {
      this.payment_status = PAYMENT_STATUS.PAID;
    } else if (this.due_date && new Date(this.due_date) < new Date()) {
      this.payment_status = PAYMENT_STATUS.OVERDUE;
    } else if (this.amount_paid > 0) {
      this.payment_status = PAYMENT_STATUS.PARTIAL;
    } else {
      this.payment_status = PAYMENT_STATUS.UNPAID;
    }
  }
  next();
});

const Overhead = mongoose.models.Overhead || mongoose.model('Overhead', overheadSchema);

module.exports = Overhead;
