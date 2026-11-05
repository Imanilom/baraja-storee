const ActivityLog = require('./activity-log.model');

class AuditService {
  async log({ entity_type, entity_id, action, performed_by, old_value, new_value, description }, session = null) {
    const logDoc = new ActivityLog({
      entity_type,
      entity_id,
      action,
      performed_by,
      old_value,
      new_value,
      description
    });

    if (session) {
      return logDoc.save({ session });
    }
    return logDoc.save();
  }

  async getLogs(filter = {}, limit = 50) {
    return ActivityLog.find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('performed_by', 'name email role');
  }
}

module.exports = new AuditService();
