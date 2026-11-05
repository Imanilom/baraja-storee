const mongoose = require('mongoose');

const MarketlistNoteSchema = new mongoose.Schema(
  {
    marketlist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Marketlist',
      required: true,
      unique: true
    },
    note: {
      type: String,
      default: ''
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketlistNote', MarketlistNoteSchema);
