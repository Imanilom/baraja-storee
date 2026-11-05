const User = require('./user.model');

class UserService {
  async getAllUsers(filter = {}) {
    return User.find(filter).select('-password_hash').populate('location_id');
  }

  async getUserById(id) {
    return User.findById(id).select('-password_hash').populate('location_id');
  }

  async createUser(userData) {
    const { name, email, password, role, location_id } = userData;
    const existing = await User.findOne({ email });
    if (existing) {
      throw new Error(`Email ${email} is already registered.`);
    }

    const password_hash = await User.hashPassword(password);
    const user = new User({
      name,
      email,
      password_hash,
      role,
      location_id
    });

    await user.save();
    const result = user.toObject();
    delete result.password_hash;
    return result;
  }

  async updateUser(id, updates) {
    if (updates.password) {
      updates.password_hash = await User.hashPassword(updates.password);
      delete updates.password;
    }
    return User.findByIdAndUpdate(id, updates, { new: true }).select('-password_hash');
  }
}

module.exports = new UserService();
