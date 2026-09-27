const WritingPrompt = require('../models/WritingPrompt');
const Poem = require('../models/Poem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const dateKey = () => new Date().toISOString().slice(0, 10);
const serialize = (item, participationCount) => ({ id: String(item._id), promptText: item.promptText, date: item.date, status: item.status, category: item.category || '', featured: Boolean(item.featured), createdAt: item.createdAt, ...(participationCount === undefined ? {} : { participationCount }) });

const today = asyncHandler(async (_req, res) => {
  const item = await WritingPrompt.findOne({ date: dateKey(), status: 'active' }).sort({ featured: -1, createdAt: -1 });
  res.json({ success: true, data: item ? serialize(item) : null });
});
const list = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: String(req.query.status) } : { status: { $ne: 'inactive' } };
  const items = await WritingPrompt.find(filter).sort({ date: -1 }).limit(60);
  res.json({ success: true, data: items.map(serialize) });
});
const poems = asyncHandler(async (req, res) => {
  const prompt = await WritingPrompt.findById(req.params.id);
  if (!prompt) throw new ApiError(404, 'Prompt not found');
  const poemsForPrompt = await Poem.find({ promptId: prompt._id, isPublic: true, visibility: 'public', moderationStatus: 'visible' }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: poemsForPrompt });
});
const create = asyncHandler(async (req, res) => {
  const { promptText, date, status = 'scheduled', category = '', featured = false } = req.body || {};
  if (!String(promptText || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new ApiError(400, 'Prompt text and a YYYY-MM-DD date are required');
  const item = await WritingPrompt.create({ promptText: String(promptText).trim(), date, status, category: String(category).trim(), featured: Boolean(featured), createdBy: req.admin.email });
  res.status(201).json({ success: true, data: serialize(item, 0) });
});
const update = asyncHandler(async (req, res) => {
  const allowed = ['promptText', 'date', 'status', 'category', 'featured']; const changes = {};
  allowed.forEach((key) => { if (req.body?.[key] !== undefined) changes[key] = key === 'promptText' || key === 'category' ? String(req.body[key]).trim() : req.body[key]; });
  const item = await WritingPrompt.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, 'Prompt not found');
  const participationCount = await Poem.countDocuments({ promptId: item._id });
  res.json({ success: true, data: serialize(item, participationCount) });
});
const adminList = asyncHandler(async (_req, res) => { const items = await WritingPrompt.find().sort({ date: -1 }).limit(100); const counts = await Poem.aggregate([{ $match: { promptId: { $ne: null } } }, { $group: { _id: '$promptId', count: { $sum: 1 } } }]); const byId = new Map(counts.map((row) => [String(row._id), row.count])); res.json({ success: true, data: items.map((item) => serialize(item, byId.get(String(item._id)) || 0)) }); });
module.exports = { today, list, poems, create, update, adminList };
