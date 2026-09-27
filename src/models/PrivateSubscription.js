const mongoose = require('mongoose');

const privateSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  plan: { type: String, enum: ['private'], default: 'private' },
  billingCycle: { type: String, enum: ['monthly', 'yearly', 'custom'] },
  status: { type: String, enum: ['active', 'expired', 'cancelled', 'grace', 'pending'], default: 'pending', index: true },
  startedAt: Date,
  expiresAt: Date,
  graceUntil: Date,
  provider: { type: String, enum: ['paystack', 'manual'], required: true },
  latestPaymentReference: { type: String, index: true },
  activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activatedByAdminEmail: { type: String, default: '' },
  activationReason: String,
}, { timestamps: true });

privateSubscriptionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.models.PrivateSubscription || mongoose.model('PrivateSubscription', privateSubscriptionSchema);
