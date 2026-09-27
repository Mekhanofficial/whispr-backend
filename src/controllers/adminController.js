const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Poem = require('../models/Poem');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const Announcement = require('../models/Announcement');
const FeatureConfig = require('../models/FeatureConfig');
const AdminAuditLog = require('../models/AdminAuditLog');
const PrivateSubscription = require('../models/PrivateSubscription');
const PrivatePayment = require('../models/PrivatePayment');
const { recordAdminAction } = require('../services/adminAudit');

function paging(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}
function paged(rows, total, page, limit) { return { items: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }; }
function safeUser(user) { const value = user.toObject ? user.toObject() : user; delete value.passwordHash; return { ...value, id: String(value._id), _id: undefined }; }

const overview = asyncHandler(async (_req, res) => {
  const [users, poems, comments, reports, activeSubscriptions, payments, recentActivity] = await Promise.all([
    User.countDocuments(), Poem.countDocuments(), Comment.countDocuments(), Report.countDocuments({ status: { $in: ['OPEN', 'REVIEWING'] } }),
    PrivateSubscription.countDocuments({ status: { $in: ['active', 'grace'] } }), PrivatePayment.countDocuments({ status: 'success' }),
    AdminAuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  res.json({ success: true, data: { metrics: { users, poems, comments, openReports: reports, activeSubscriptions, successfulPayments: payments }, recentActivity } });
});

const users = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req); const query = {};
  const q = String(req.query.q || '').trim(); if (q) query.$or = [{ email: new RegExp(q, 'i') }, { fullName: new RegExp(q, 'i') }];
  if (req.query.status === 'suspended') query.isSuspended = true; if (req.query.status === 'active') query.isSuspended = { $ne: true };
  if (req.query.eligible === 'true') query.privateAccessEligible = true; if (req.query.eligible === 'false') query.privateAccessEligible = false;
  const [rows, total] = await Promise.all([User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(query)]);
  res.json({ success: true, data: paged(rows.map(safeUser), total, page, limit) });
});

const userDetail = asyncHandler(async (req, res) => { const user = await User.findById(req.params.userId).select('-passwordHash').lean(); if (!user) throw new ApiError(404, 'User not found'); res.json({ success: true, data: safeUser(user) }); });
const setSuspended = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId); if (!user) throw new ApiError(404, 'User not found');
  const suspended = req.path.endsWith('/suspend'); const oldValue = { isSuspended: user.isSuspended };
  user.isSuspended = suspended; user.suspendedAt = suspended ? new Date() : null; user.suspendedReason = suspended ? String(req.body?.reason || 'Administrator action').slice(0, 240) : ''; await user.save();
  await recordAdminAction({ req, action: suspended ? 'user.suspend' : 'user.unsuspend', targetType: 'user', targetId: String(user._id), summary: `${suspended ? 'Suspended' : 'Unsuspended'} ${user.email}`, oldValue, newValue: { isSuspended: suspended }, reason: req.body?.reason });
  res.json({ success: true, data: { id: String(user._id), isSuspended: user.isSuspended } });
});

async function listContent(Model, req, res, label) { const { page, limit, skip } = paging(req); const q = String(req.query.q || '').trim(); const query = q ? (label === 'poem' ? { $or: [{ title: new RegExp(q, 'i') }, { author: new RegExp(q, 'i') }] } : { body: new RegExp(q, 'i') }) : {}; const [items, total] = await Promise.all([Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Model.countDocuments(query)]); res.json({ success: true, data: paged(items, total, page, limit) }); }
const poems = asyncHandler((req, res) => listContent(Poem, req, res, 'poem'));
const comments = asyncHandler((req, res) => listContent(Comment, req, res, 'comment'));
const moderate = asyncHandler(async (req, res) => { const Model = req.params.type === 'poem' ? Poem : req.params.type === 'comment' ? Comment : null; if (!Model) throw new ApiError(400, 'Invalid content type'); const item = await Model.findById(req.params.id); if (!item) throw new ApiError(404, 'Content not found'); const status = req.body?.status === 'hidden' ? 'hidden' : 'visible'; const oldValue = { moderationStatus: item.moderationStatus }; item.moderationStatus = status; await item.save(); await recordAdminAction({ req, action: 'content.moderate', targetType: req.params.type, targetId: req.params.id, summary: `Set ${req.params.type} moderation status to ${status}`, oldValue, newValue: { moderationStatus: status }, reason: req.body?.reason }); res.json({ success: true, data: item }); });

const reports = asyncHandler(async (req, res) => { const { page, limit, skip } = paging(req); const query = req.query.status ? { status: String(req.query.status).toUpperCase() } : {}; const [items, total] = await Promise.all([Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Report.countDocuments(query)]); res.json({ success: true, data: paged(items, total, page, limit) }); });
const updateReport = asyncHandler(async (req, res) => { const item = await Report.findById(req.params.id); if (!item) throw new ApiError(404, 'Report not found'); const status = String(req.body?.status || '').toUpperCase(); if (!['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'].includes(status)) throw new ApiError(400, 'Invalid report status'); const oldValue = { status: item.status }; item.status = status; item.assignedAdminEmail = req.admin.email; item.resolutionNote = String(req.body?.resolutionNote || '').slice(0, 1000); await item.save(); await recordAdminAction({ req, action: 'report.update', targetType: 'report', targetId: req.params.id, summary: `Updated report to ${status}`, oldValue, newValue: { status }, reason: item.resolutionNote }); res.json({ success: true, data: item }); });

const announcements = asyncHandler(async (req, res) => { const { page, limit, skip } = paging(req); const [items, total] = await Promise.all([Announcement.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Announcement.countDocuments()]); res.json({ success: true, data: paged(items, total, page, limit) }); });
const createAnnouncement = asyncHandler(async (req, res) => { const title = String(req.body?.title || '').trim(); const message = String(req.body?.message || '').trim(); if (!title || !message) throw new ApiError(400, 'Title and message are required'); const item = await Announcement.create({ title, message, audience: req.body?.audience || 'all', active: req.body?.active !== false, createdBy: req.admin.email }); await recordAdminAction({ req, action: 'announcement.create', targetType: 'announcement', targetId: String(item._id), summary: `Created announcement: ${title}` }); res.status(201).json({ success: true, data: item }); });
const updateAnnouncement = asyncHandler(async (req, res) => { const item = await Announcement.findByIdAndUpdate(req.params.id, { $set: { ...req.body, createdBy: undefined } }, { new: true, runValidators: true }); if (!item) throw new ApiError(404, 'Announcement not found'); await recordAdminAction({ req, action: 'announcement.update', targetType: 'announcement', targetId: req.params.id, summary: 'Updated announcement' }); res.json({ success: true, data: item }); });

const configuration = asyncHandler(async (_req, res) => { const item = await FeatureConfig.findOneAndUpdate({ key: 'default' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }); res.json({ success: true, data: item }); });
const updateConfiguration = asyncHandler(async (req, res) => { const allowed = ['registrationEnabled', 'poetryPublishing', 'comments', 'privateSubscriptions', 'maintenanceMode', 'externalPoetry']; const updates = {}; allowed.forEach((key) => { if (req.body?.[key] !== undefined) updates[key] = Boolean(req.body[key]); }); const item = await FeatureConfig.findOneAndUpdate({ key: 'default' }, { $set: updates }, { upsert: true, new: true, setDefaultsOnInsert: true }); await recordAdminAction({ req, action: 'configuration.update', targetType: 'configuration', targetId: 'default', summary: 'Updated feature configuration', newValue: updates }); res.json({ success: true, data: item }); });
const audit = asyncHandler(async (req, res) => { const { page, limit, skip } = paging(req); const query = {}; if (req.query.action) query.action = String(req.query.action); if (req.query.adminEmail) query.adminEmail = String(req.query.adminEmail).toLowerCase(); const [items, total] = await Promise.all([AdminAuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AdminAuditLog.countDocuments(query)]); res.json({ success: true, data: paged(items, total, page, limit) }); });
const subscriptions = asyncHandler(async (req, res) => { const { page, limit, skip } = paging(req); const [items, total] = await Promise.all([PrivateSubscription.find().populate('userId', 'email fullName').sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(), PrivateSubscription.countDocuments()]); res.json({ success: true, data: paged(items, total, page, limit) }); });
const payments = asyncHandler(async (req, res) => { const { page, limit, skip } = paging(req); const [items, total] = await Promise.all([PrivatePayment.find().populate('userId', 'email fullName').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PrivatePayment.countDocuments()]); res.json({ success: true, data: paged(items, total, page, limit) }); });

module.exports = { overview, users, userDetail, setSuspended, poems, comments, moderate, reports, updateReport, announcements, createAnnouncement, updateAnnouncement, configuration, updateConfiguration, audit, subscriptions, payments };
