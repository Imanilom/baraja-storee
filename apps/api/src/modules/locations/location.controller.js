const Location = require('./location.model');
const { sendSuccess, sendError } = require('../../utils/response');

class LocationController {
  async list(req, res) {
    try {
      const locations = await Location.find({ is_active: true }).sort({ name: 1 });
      return sendSuccess(res, 'Locations retrieved successfully', locations);
    } catch (error) {
      return sendError(res, 'Failed to retrieve locations', error.message, 500);
    }
  }
}

module.exports = new LocationController();

