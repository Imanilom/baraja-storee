const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('@purchasing/constants');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password_hash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true
    },
    location_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Method to verify password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Static method to hash password
UserSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

module.exports = mongoose.model('User', UserSchema);

