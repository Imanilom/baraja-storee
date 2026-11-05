const MarketlistNote = require('./marketlist-note.model');
const Marketlist = require('../marketlists/marketlist.model');
const auditService = require('../audit/audit.service');

class MarketlistNoteService {
  async getNoteByMarketlistId(marketlistId) {
    let noteDoc = await MarketlistNote.findOne({ marketlist_id: marketlistId }).populate('updated_by', 'name email role');
    if (!noteDoc) {
      noteDoc = await MarketlistNote.create({
        marketlist_id: marketlistId,
        note: ''
      });
    }
    return noteDoc;
  }

  async upsertNote(marketlistId, noteText, user) {
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) {
      throw new Error('Marketlist not found');
    }

    let existing = await MarketlistNote.findOne({ marketlist_id: marketlistId });
    const oldValue = existing ? existing.note : '';

    if (!existing) {
      existing = new MarketlistNote({
        marketlist_id: marketlistId,
        note: noteText,
        updated_by: user._id
      });
    } else {
      existing.note = noteText;
      existing.updated_by = user._id;
    }

    const saved = await existing.save();

    // Log note change in activity logs
    await auditService.log({
      entity_type: 'note',
      entity_id: saved._id,
      action: 'note_updated',
      performed_by: user._id,
      old_value: { note: oldValue },
      new_value: { note: noteText },
      description: `Updated note for marketlist ${marketlist.marketlist_number}`
    });

    return saved.populate('updated_by', 'name email role');
  }
}

module.exports = new MarketlistNoteService();

