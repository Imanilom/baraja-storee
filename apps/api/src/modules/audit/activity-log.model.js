const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  entity_type: {
    type: String,
    required: true,
    enum: ['marketlist', 'goods_receipt', 'invoice', 'product', 'supplier', 'note', 'user']
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  performed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  old_value: mongoose.Schema.Types.Mixed,
  new_value: mongoose.Schema.Types.Mixed,
  description: String,
  created_at: {
    type: Date,
    default: Date.now
  }
});

ActivityLogSchema.index({ entity_type: 1, entity_id: 1, created_at: -1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
