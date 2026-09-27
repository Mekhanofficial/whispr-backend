const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema({
  adminEmail: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  summary: { type: String, required: true, maxlength: 500 },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: undefined },
  newValue: { type: mongoose.Schema.Types.Mixed, default: undefined },
  reason: { type: String, default: '', maxlength: 500 },
  ip: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

adminAuditLogSchema.index({ createdAt: -1 });
module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', adminAuditLogSchema);
