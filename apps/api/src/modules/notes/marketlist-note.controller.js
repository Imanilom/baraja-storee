const marketlistNoteService = require('./marketlist-note.service');
const { sendSuccess, sendError } = require('../../utils/response');

class MarketlistNoteController {
  async get(req, res) {
    try {
      const note = await marketlistNoteService.getNoteByMarketlistId(req.params.id);
      return sendSuccess(res, 'Note retrieved', note);
    } catch (error) {
      return sendError(res, 'Failed to fetch note', error.message, 500);
    }
  }

  async update(req, res) {
    try {
      const { note } = req.body;
      const result = await marketlistNoteService.upsertNote(req.params.id, note, req.user);
      return sendSuccess(res, 'Note updated successfully', result);
    } catch (error) {
      return sendError(res, 'Failed to update note', error.message, 400);
    }
  }
}

module.exports = new MarketlistNoteController();
