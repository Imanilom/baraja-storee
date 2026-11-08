const User = require('./user.model');

class UserService {
  async getAllUsers(query = {}) {
    const filter = {};
    if (query.role) {
      filter.role = query.role;
    }
    if (query.is_active !== undefined && query.is_active !== '') {
      filter.is_active = query.is_active === 'true' || query.is_active === true;
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } }
      ];
    }
    return User.find(filter)
      .select('-password_hash')
      .populate('location_id', 'name code address')
      .sort({ createdAt: -1 });
  }

  async getUserById(id) {
    return User.findById(id).select('-password_hash').populate('location_id', 'name code address');
  }

  async createUser(userData) {
    const { name, email, password, role, location_id, is_active } = userData;
    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw new Error(`Email ${cleanEmail} sudah terdaftar.`);
    }

    const password_hash = await User.hashPassword(password);
    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      password_hash,
      role,
      location_id: location_id && location_id !== '' ? location_id : null,
      is_active: is_active !== undefined ? is_active : true
    });

    await user.save();
    return User.findById(user._id).select('-password_hash').populate('location_id', 'name code address');
  }

  async updateUser(id, updates) {
    if (updates.email) {
      updates.email = updates.email.trim().toLowerCase();
      const existing = await User.findOne({ email: updates.email, _id: { $ne: id } });
      if (existing) {
        throw new Error(`Email ${updates.email} sudah digunakan oleh pengguna lain.`);
      }
    }
    if (updates.password && updates.password.trim().length >= 6) {
      updates.password_hash = await User.hashPassword(updates.password.trim());
      delete updates.password;
    } else {
      delete updates.password;
    }
    if (updates.location_id === '' || updates.location_id === 'none') {
      updates.location_id = null;
    }
    return User.findByIdAndUpdate(id, updates, { new: true })
      .select('-password_hash')
      .populate('location_id', 'name code address');
  }

  async deleteUser(id, currentUserId) {
    if (id.toString() === currentUserId.toString()) {
      throw new Error('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.');
    }
    const user = await User.findById(id);
    if (!user) {
      throw new Error('Pengguna tidak ditemukan.');
    }
    await User.findByIdAndDelete(id);
    return { id, message: 'User deleted successfully' };
  }
}

module.exports = new UserService();
