const mongoose = require('mongoose');

const privateAccessSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  monthlyPrice: { type: Number, default: 0, min: 0 },
  yearlyPrice: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'NGN', uppercase: true, trim: true },
  isSubscriptionEnabled: { type: Boolean, default: false },
  gracePeriodHours: { type: Number, default: 72, min: 0, max: 720 },
}, { timestamps: true });

module.exports = mongoose.models.PrivateAccessSettings || mongoose.model('PrivateAccessSettings', privateAccessSettingsSchema);
