const mongoose = require('mongoose');
const reportSchema = new mongoose.Schema({
  type: { type: String, enum: ['poem', 'comment', 'user', 'other'], default: 'other' },
  targetId: { type: String, required: true, index: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'], default: 'OPEN', index: true },
  assignedAdminEmail: { type: String, default: '' },
  resolutionNote: { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });
reportSchema.index({ createdAt: -1 });
module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
