const mongoose = require('mongoose');

const IntegrationEventSchema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true },
    event_type: { type: String, required: true },
    source_system: { type: String, required: true, default: 'BARAJA_STORE' },
    aggregate_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    aggregate_type: {
      type: String,
      enum: ['goods_receipt', 'waste'],
      default: 'goods_receipt'
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'failed'],
      default: 'pending'
    },
    attempts: { type: Number, default: 0, min: 0 },
    next_attempt_at: { type: Date, default: Date.now },
    lease_until: Date,
    last_error: String,
    delivered_at: Date
  },
  { timestamps: true }
);

IntegrationEventSchema.index({ status: 1, next_attempt_at: 1 });
IntegrationEventSchema.index({ aggregate_id: 1, createdAt: -1 });

module.exports = mongoose.model('StoreIntegrationEvent', IntegrationEventSchema);
