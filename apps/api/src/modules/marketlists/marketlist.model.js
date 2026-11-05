const mongoose = require('mongoose');
const { MARKETLIST_STATUS } = require('@purchasing/constants');

const MarketlistSchema = new mongoose.Schema(
  {
    marketlist_number: {
      type: String,
      required: true,
      unique: true
    },
    date: {
      type: Date,
      required: true
    },
    required_date: {
      type: Date,
      required: true
    },
    location_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assigned_to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    status: {
      type: String,
      enum: Object.values(MARKETLIST_STATUS),
      default: MARKETLIST_STATUS.DRAFT
    },
    totals: {
      total_items: { type: Number, default: 0 },
      total_quantity: { type: Number, default: 0 },
      estimated_amount: { type: Number, default: 0 }
    },
    approval: {
      approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approved_at: Date,
      approval_note: String
    },
    approved_version: Number,
    current_version: {
      type: Number,
      default: 1
    },
    submitted_at: Date,
    completed_at: Date
  },
  { timestamps: true }
);

MarketlistSchema.index({ status: 1, date: -1 });
MarketlistSchema.index({ assigned_to: 1, status: 1 });

module.exports = mongoose.model('Marketlist', MarketlistSchema);

