const AdminAuditLog = require('../models/AdminAuditLog');

async function recordAdminAction({ req, action, targetType = '', targetId = '', summary, oldValue, newValue, reason = '' }) {
  return AdminAuditLog.create({
    adminEmail: req.admin?.email || 'system', action, targetType, targetId, summary,
    oldValue, newValue, reason: String(reason || '').slice(0, 500),
    ip: String(req.ip || '').slice(0, 100),
  });
}

module.exports = { recordAdminAction };
