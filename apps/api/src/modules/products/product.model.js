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
    item_type: {
      type: String,
      enum: ['perishable', 'groceries'],
      default: 'groceries',
      index: true
    },
    department: {
      type: String,
      enum: ['kitchen', 'bar'],
      default: null,
      index: true
    },
    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true
    },
    specification: String,
    last_purchase_price: {
      type: Number,
      default: 0
    },
    current_stock: {
      type: Number,
      default: 0
    },
    last_supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
