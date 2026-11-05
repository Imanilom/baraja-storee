const jwt = require('jsonwebtoken');
const User = require('../users/user.model');
const { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN } = require('../../config/env');

class AuthService {
  generateTokens(user) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

    return { accessToken, refreshToken };
  }

  async login(email, password) {
    const user = await User.findOne({ email }).populate('location_id');
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
      throw new Error('Your account is inactive. Please contact administrator.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const tokens = this.generateTokens(user);

    const userProfile = user.toObject();
    delete userProfile.password_hash;

    return {
      user: userProfile,
      tokens
    };
  }

  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }
  }
}

module.exports = new AuthService();

