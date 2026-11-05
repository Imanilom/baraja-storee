const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    abbreviation: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Unit', UnitSchema);
