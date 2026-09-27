const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const User = require('../models/User');
const PrivateSubscription = require('../models/PrivateSubscription');
const PrivatePayment = require('../models/PrivatePayment');
const PrivateAccessSettings = require('../models/PrivateAccessSettings');
const { effectiveStatus } = require('../middleware/privateAccess');

const VALID_CYCLES = new Set(['monthly', 'yearly']);

function publicSubscription(subscription, now = new Date()) {
  if (!subscription) return null;
  return {
    status: effectiveStatus(subscription, now),
    billingCycle: subscription.billingCycle || null,
    expiresAt: subscription.expiresAt || null,
    graceUntil: subscription.graceUntil || null,
  };
}

async function getSettings() {
  return PrivateAccessSettings.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function priceFor(settings, billingCycle) {
  return billingCycle === 'monthly' ? Number(settings.monthlyPrice) : Number(settings.yearlyPrice);
}

function addCycle(date, billingCycle) {
  const next = new Date(date);
  if (billingCycle === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

async function paystackRequest(path, options = {}) {
  if (!env.paystackSecretKey) throw new ApiError(503, 'Payment service is not configured');
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.paystackSecretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === false) {
    throw new ApiError(502, payload?.message || 'Payment provider request failed');
  }
  return payload?.data || payload;
}

async function getPrivateStatus(req, res) {
  if (!req.user.privateAccessEligible) return res.json({ success: true, data: { eligible: false } });
  const subscription = await PrivateSubscription.findOne({ userId: req.user._id });
  res.json({ success: true, data: { eligible: true, subscription: publicSubscription(subscription) } });
}

async function getPlans(req, res) {
  if (!req.user.privateAccessEligible) throw new ApiError(404, 'Not found');
  const settings = await getSettings();
  if (!settings.isSubscriptionEnabled) throw new ApiError(503, 'Private access is unavailable');
  res.json({
    success: true,
    data: {
      currency: settings.currency,
      paymentAvailable: Boolean(env.paystackSecretKey),
      monthly: { amount: Number(settings.monthlyPrice), label: `${settings.currency} ${Number(settings.monthlyPrice).toLocaleString()}` },
      yearly: { amount: Number(settings.yearlyPrice), label: `${settings.currency} ${Number(settings.yearlyPrice).toLocaleString()}` },
    },
  });
}

async function initializeCheckout(req, res) {
  if (!req.user.privateAccessEligible) throw new ApiError(404, 'Not found');
  const billingCycle = String(req.body?.billingCycle || '').toLowerCase();
  if (!VALID_CYCLES.has(billingCycle)) throw new ApiError(400, 'Invalid billing cycle');
  const settings = await getSettings();
  if (!settings.isSubscriptionEnabled) throw new ApiError(503, 'Private access is unavailable');
  const configuredPrice = priceFor(settings, billingCycle);
  if (!Number.isFinite(configuredPrice) || configuredPrice <= 0) throw new ApiError(503, 'Private access pricing is not configured');

  const reference = `whispr_private_${req.user._id}_${crypto.randomUUID()}`;
  const amount = Math.round(configuredPrice * 100);
  await PrivatePayment.create({ userId: req.user._id, reference, amount, currency: settings.currency, billingCycle, status: 'pending', provider: 'paystack' });
  try {
    const checkout = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({ email: req.user.email, amount, currency: settings.currency, reference, callback_url: env.paystackCallbackUrl || undefined, metadata: { userId: String(req.user._id), billingCycle, plan: 'private' } }),
    });
    res.json({ success: true, data: { reference, checkoutUrl: checkout.authorization_url, accessCode: checkout.access_code } });
  } catch (error) {
    await PrivatePayment.updateOne({ reference }, { $set: { status: 'failed' } });
    throw error;
  }
}

async function applyVerifiedPayment(payment, providerData) {
  if (payment.activationAppliedAt) return PrivateSubscription.findOne({ userId: payment.userId });
  const claimTime = new Date();
  const claim = await PrivatePayment.findOneAndUpdate(
    { _id: payment._id, activationAppliedAt: { $exists: false } },
    { $set: { activationAppliedAt: claimTime } },
    { new: false },
  );
  if (!claim) return PrivateSubscription.findOne({ userId: payment.userId });
  const settings = await getSettings();
  const now = new Date();
  const existing = await PrivateSubscription.findOne({ userId: payment.userId });
  const base = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = addCycle(base, payment.billingCycle);
  const graceUntil = new Date(expiresAt.getTime() + Number(settings.gracePeriodHours || 0) * 60 * 60 * 1000);
  try {
    return await PrivateSubscription.findOneAndUpdate(
      { userId: payment.userId },
      { $set: { plan: 'private', billingCycle: payment.billingCycle, status: 'active', startedAt: existing?.startedAt || now, expiresAt, graceUntil, provider: 'paystack', latestPaymentReference: payment.reference } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    await PrivatePayment.updateOne({ _id: payment._id, activationAppliedAt: claimTime }, { $unset: { activationAppliedAt: 1 } });
    throw error;
  }
}

async function verifyPaymentForUser(req, res) {
  if (!req.user.privateAccessEligible) throw new ApiError(404, 'Not found');
  const reference = String(req.body?.reference || '').trim();
  if (!reference) throw new ApiError(400, 'Payment reference is required');
  const payment = await PrivatePayment.findOne({ reference, userId: req.user._id });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.activationAppliedAt) return res.json({ success: true, data: { subscription: publicSubscription(await PrivateSubscription.findOne({ userId: req.user._id })) } });
  const provider = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  const expectedAmount = payment.amount;
  const providerEmail = String(provider.customer?.email || '').toLowerCase();
  if (provider.status !== 'success' || Number(provider.amount) !== expectedAmount || String(provider.currency).toUpperCase() !== String(payment.currency).toUpperCase() || String(provider.reference) !== reference || (providerEmail && providerEmail !== String(req.user.email).toLowerCase())) {
    await PrivatePayment.updateOne({ _id: payment._id }, { $set: { status: 'failed', verifiedAt: new Date(), metadata: provider } });
    throw new ApiError(402, 'Payment could not be verified');
  }
  await PrivatePayment.updateOne({ _id: payment._id }, { $set: { status: 'success', paidAt: provider.paid_at ? new Date(provider.paid_at) : new Date(), verifiedAt: new Date(), metadata: provider } });
  const subscription = await applyVerifiedPayment(payment, provider);
  res.json({ success: true, data: { subscription: publicSubscription(subscription) } });
}

async function paystackWebhook(req, res) {
  const signature = String(req.headers['x-paystack-signature'] || '');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha512', env.paystackWebhookSecret).update(raw).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (!env.paystackWebhookSecret || !signature || signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return res.sendStatus(401);
  if (req.body?.event !== 'charge.success') return res.sendStatus(200);
  const data = req.body.data || {};
  const payment = await PrivatePayment.findOne({ reference: data.reference });
  if (!payment || payment.activationAppliedAt) return res.sendStatus(200);
  if (data.status !== 'success' || Number(data.amount) !== payment.amount || String(data.currency).toUpperCase() !== payment.currency) return res.sendStatus(200);
  // A valid signature confirms origin; provider verification confirms the final state.
  let provider;
  try { provider = await paystackRequest(`/transaction/verify/${encodeURIComponent(payment.reference)}`); }
  catch (_) { return res.sendStatus(503); }
  const user = await User.findById(payment.userId).select('email').lean();
  const providerEmail = String(provider.customer?.email || '').toLowerCase();
  if (provider.status !== 'success' || Number(provider.amount) !== payment.amount || String(provider.currency).toUpperCase() !== String(payment.currency).toUpperCase() || String(provider.reference) !== payment.reference || (providerEmail && providerEmail !== String(user?.email || '').toLowerCase())) return res.sendStatus(200);
  await PrivatePayment.updateOne({ _id: payment._id }, { $set: { status: 'success', paidAt: provider.paid_at ? new Date(provider.paid_at) : new Date(), verifiedAt: new Date(), metadata: provider } });
  await applyVerifiedPayment(payment, provider);
  return res.sendStatus(200);
}

module.exports = { getPrivateStatus, getPlans, initializeCheckout, verifyPaymentForUser, paystackWebhook, getSettings, applyVerifiedPayment, effectiveStatus, addCycle };
