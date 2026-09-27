const mongoose = require('mongoose');

const writingPromptSchema = new mongoose.Schema({
  promptText: { type: String, required: true, trim: true, maxlength: 800 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['scheduled', 'active', 'inactive'], default: 'scheduled', index: true },
  category: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

writingPromptSchema.index({ date: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
module.exports = mongoose.models.WritingPrompt || mongoose.model('WritingPrompt', writingPromptSchema);
