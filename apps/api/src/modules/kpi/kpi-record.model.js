const mongoose = require('mongoose');

const KpiRecordSchema = new mongoose.Schema(
  {
    marketlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Marketlist',
      required: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    metrics: {
      receiving_accuracy: Number,
      item_fulfillment: Number,
      on_time_receiving: Number,
      price_variance: Number,
      document_completeness: Number
    },
    issue_count: {
      type: Number,
      default: 0
    },
    admin_evaluation: {
      score: Number,
      comment: String,
      evaluated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      evaluated_at: Date
    },
    final_score: Number,
    calculated_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('KpiRecord', KpiRecordSchema);
