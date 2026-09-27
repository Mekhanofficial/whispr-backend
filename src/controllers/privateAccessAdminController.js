const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const PrivateSubscription = require('../models/PrivateSubscription');
const PrivatePayment = require('../models/PrivatePayment');
const PrivateAccessSettings = require('../models/PrivateAccessSettings');
const { effectiveStatus, getSettings, addCycle } = require('./privateAccessController');
const { recordAdminAction } = require('../services/adminAudit');

function subscriptionSummary(subscription) {
  return subscription ? { status: effectiveStatus(subscription), billingCycle: subscription.billingCycle, expiresAt: subscription.expiresAt, graceUntil: subscription.graceUntil } : { status: 'none' };
}

async function getPricing(_req, res) {
  const settings = await getSettings();
  res.json({ success: true, data: settings });
}

async function updatePricing(req, res) {
  const updates = {};
  for (const key of ['monthlyPrice', 'yearlyPrice', 'gracePeriodHours']) {
    if (req.body?.[key] !== undefined) {
      const value = Number(req.body[key]);
      if (!Number.isFinite(value) || value < 0) throw new ApiError(400, `Invalid ${key}`);
      updates[key] = value;
    }
  }
  if (req.body?.currency !== undefined) {
    const currency = String(req.body.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new ApiError(400, 'Invalid currency');
    updates.currency = currency;
  }
  if (req.body?.isSubscriptionEnabled !== undefined) updates.isSubscriptionEnabled = Boolean(req.body.isSubscriptionEnabled);
  const settings = await PrivateAccessSettings.findOneAndUpdate({ key: 'default' }, { $set: updates, $setOnInsert: { key: 'default' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await recordAdminAction({ req, action: 'private_access.pricing.update', targetType: 'pricing', targetId: 'default', summary: 'Updated private access pricing', newValue: updates });
  res.json({ success: true, data: settings });
}

async function listUsers(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const query = req.query.q ? { $or: [{ email: new RegExp(String(req.query.q), 'i') }, { fullName: new RegExp(String(req.query.q), 'i') }] } : {};
  const [users, total] = await Promise.all([User.find(query).select('fullName email privateAccessEligible').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(query)]);
  const ids = users.map((user) => user._id);
  const subscriptions = await PrivateSubscription.find({ userId: { $in: ids } }).lean();
  const byUser = new Map(subscriptions.map((subscription) => [String(subscription.userId), subscription]));
  res.json({ success: true, data: { items: users.map((user) => ({ id: String(user._id), name: user.fullName, email: user.email, eligible: Boolean(user.privateAccessEligible), subscription: subscriptionSummary(byUser.get(String(user._id))) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

async function setEligibility(req, res) {
  const user = await User.findByIdAndUpdate(req.params.userId, { $set: { privateAccessEligible: Boolean(req.body?.eligible) } }, { new: true }).select('fullName email privateAccessEligible');
  if (!user) throw new ApiError(404, 'User not found');
  await recordAdminAction({ req, action: 'private_access.eligibility.update', targetType: 'user', targetId: String(user._id), summary: `Set private access eligibility for ${user.email}`, newValue: { eligible: user.privateAccessEligible } });
  res.json({ success: true, data: { id: String(user._id), eligible: user.privateAccessEligible } });
}

async function activateManually(req, res) {
  const user = await User.findById(req.params.userId);
  if (!user) throw new ApiError(404, 'User not found');
  const cycle = String(req.body?.billingCycle || '').toLowerCase();
  if (!['monthly', 'yearly', 'custom'].includes(cycle)) throw new ApiError(400, 'Invalid billing cycle');
  const now = new Date();
  const current = await PrivateSubscription.findOne({ userId: user._id });
  if (cycle === 'custom' && !req.body?.expiresAt) throw new ApiError(400, 'Custom access requires an expiry');
  const base = req.body?.expiresAt ? now : current?.expiresAt && current.expiresAt > now ? current.expiresAt : now;
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : addCycle(base, cycle);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw new ApiError(400, 'Invalid expiry');
  const subscription = await PrivateSubscription.findOneAndUpdate({ userId: user._id }, { $set: { plan: 'private', billingCycle: cycle, status: 'active', startedAt: current?.startedAt || now, expiresAt, graceUntil: null, provider: 'manual', activatedBy: null, activatedByAdminEmail: req.admin.email, activationReason: String(req.body?.reason || 'manual activation').slice(0, 240) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (!user.privateAccessEligible) {
    user.privateAccessEligible = true;
    await user.save();
  }
  await recordAdminAction({ req, action: 'private_access.activate', targetType: 'user', targetId: String(user._id), summary: `Manually activated private access for ${user.email}`, newValue: { billingCycle: cycle, expiresAt }, reason: req.body?.reason });
  res.json({ success: true, data: subscriptionSummary(subscription) });
}

async function cancel(req, res) {
  const subscription = await PrivateSubscription.findOne({ userId: req.params.userId });
  if (!subscription) throw new ApiError(404, 'Subscription not found');
  const endNow = req.body?.endNow === true;
  subscription.status = 'cancelled';
  if (endNow) {
    subscription.expiresAt = new Date();
    subscription.graceUntil = null;
  }
  await subscription.save();
  await recordAdminAction({ req, action: 'private_access.cancel', targetType: 'user', targetId: req.params.userId, summary: endNow ? 'Ended private access immediately' : 'Cancelled private access at expiry', newValue: { endNow } });
  res.json({ success: true, data: subscriptionSummary(subscription) });
}

async function payments(req, res) {
  const query = req.params.userId ? { userId: req.params.userId } : {};
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const [records, total] = await Promise.all([PrivatePayment.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), PrivatePayment.countDocuments(query)]);
  res.json({ success: true, data: { items: records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

async function summary(_req, res) {
  const [eligibleUsers, activeSubscriptions, expiredSubscriptions, payments] = await Promise.all([
    User.countDocuments({ privateAccessEligible: true }),
    PrivateSubscription.countDocuments({ status: { $in: ['active', 'grace'] } }),
    PrivateSubscription.countDocuments({ status: 'expired' }),
    PrivatePayment.find({ status: 'success' }).select('amount currency').lean(),
  ]);
  res.json({ success: true, data: { eligibleUsers, activeSubscriptions, expiredSubscriptions, successfulPayments: payments.length, revenueByCurrency: payments.reduce((result, payment) => { result[payment.currency] = (result[payment.currency] || 0) + Number(payment.amount || 0); return result; }, {}) } });
}

module.exports = { getPricing, updatePricing, listUsers, setEligibility, activateManually, cancel, payments, summary };
