const mongoose = require('mongoose');

const MarketlistApprovalSchema = new mongoose.Schema({
  marketlist_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marketlist',
    required: true
  },
  version: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    enum: ['approved', 'rejected', 'revision'],
    required: true
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  note: String,
  created_at: {
    type: Date,
    default: Date.now
  }
});

MarketlistApprovalSchema.index({ marketlist_id: 1, created_at: -1 });

module.exports = mongoose.model('MarketlistApproval', MarketlistApprovalSchema);

