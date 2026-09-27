const mongoose = require('mongoose');

const privatePaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reference: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
  provider: { type: String, enum: ['paystack', 'manual'], required: true },
  paidAt: Date,
  verifiedAt: Date,
  activationAppliedAt: Date,
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.models.PrivatePayment || mongoose.model('PrivatePayment', privatePaymentSchema);
