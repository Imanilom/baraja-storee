const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true
    },
    specification: String,
    is_active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);

