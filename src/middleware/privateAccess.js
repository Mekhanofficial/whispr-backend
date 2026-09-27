const PrivateSubscription = require('../models/PrivateSubscription');
const ApiError = require('../utils/ApiError');

function effectiveStatus(subscription, now = new Date()) {
  if (!subscription) return 'none';
  if (subscription.status === 'pending') return 'pending';
  if (subscription.status === 'cancelled' && subscription.expiresAt && subscription.expiresAt > now) return 'active';
  if (subscription.expiresAt && subscription.expiresAt > now) return subscription.status === 'grace' ? 'grace' : 'active';
  if (subscription.graceUntil && subscription.graceUntil > now) return 'grace';
  return 'expired';
}

async function requirePrivateAccess(req, _res, next) {
  try {
    const subscription = await PrivateSubscription.findOne({ userId: req.user._id });
    const status = effectiveStatus(subscription);
    if (!['active', 'grace'].includes(status)) throw new ApiError(403, 'Private access subscription required');
    req.privateSubscription = subscription;
    req.privateSubscriptionStatus = status;
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(403, 'Private access subscription required'));
  }
}

module.exports = { effectiveStatus, requirePrivateAccess };
