const mongoose = require('mongoose');
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  audience: { type: String, enum: ['all', 'eligible', 'admins'], default: 'all' },
  active: { type: Boolean, default: true },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: null },
  createdBy: { type: String, required: true },
}, { timestamps: true });
module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
