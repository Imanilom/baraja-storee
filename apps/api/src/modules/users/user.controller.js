const userService = require('./user.service');
const { sendSuccess, sendError } = require('../../utils/response');

class UserController {
  async list(req, res) {
    try {
      const users = await userService.getAllUsers();
      return sendSuccess(res, 'Users retrieved successfully', users);
    } catch (error) {
      return sendError(res, 'Failed to retrieve users', error.message, 500);
    }
  }

  async getById(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);
      if (!user) {
        return sendError(res, 'User not found', null, 404);
      }
      return sendSuccess(res, 'User details retrieved', user);
    } catch (error) {
      return sendError(res, 'Failed to retrieve user', error.message, 500);
    }
  }

  async create(req, res) {
    try {
      const user = await userService.createUser(req.body);
      return sendSuccess(res, 'User created successfully', user, 201);
    } catch (error) {
      return sendError(res, 'Failed to create user', error.message, 400);
    }
  }

  async update(req, res) {
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      if (!user) {
        return sendError(res, 'User not found', null, 404);
      }
      return sendSuccess(res, 'User updated successfully', user);
    } catch (error) {
      return sendError(res, 'Failed to update user', error.message, 400);
    }
  }
}

module.exports = new UserController();

