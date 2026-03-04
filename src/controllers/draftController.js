const Draft = require('../models/Draft');
const Activity = require('../models/Activity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { serializeDraft } = require('../utils/serializers');

function formatDate(date = new Date()) {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const listDrafts = asyncHandler(async (req, res) => {
  const drafts = await Draft.find({ userId: req.user._id }).sort({ updatedAt: -1 });
  res.json({ success: true, data: drafts.map(serializeDraft) });
});

const createDraft = asyncHandler(async (req, res) => {
  const { title, body, category } = req.body || {};
  const draft = await Draft.create({
    userId: req.user._id,
    title: String(title || 'Untitled Draft').trim() || 'Untitled Draft',
    body: String(body || ''),
    category: String(category || ''),
    lastEdited: formatDate(),
  });

  await Activity.create({
    userId: req.user._id,
    type: 'draft_saved',
    title: draft.title,
    draftId: String(draft._id),
    description: 'Saved a new draft',
    timestamp: new Date(),
  });

  res.status(201).json({ success: true, data: serializeDraft(draft) });
});

const updateDraft = asyncHandler(async (req, res) => {
  const draft = await Draft.findOne({ _id: req.params.id, userId: req.user._id });
  if (!draft) throw new ApiError(404, 'Draft not found');

  const { title, body, category } = req.body || {};
  if (title !== undefined) draft.title = String(title || '').trim() || 'Untitled Draft';
  if (body !== undefined) draft.body = String(body || '');
  if (category !== undefined) draft.category = String(category || '');
  draft.lastEdited = formatDate();
  await draft.save();

  await Activity.create({
    userId: req.user._id,
    type: 'draft_updated',
    title: draft.title,
    draftId: String(draft._id),
    description: 'Updated a draft',
    timestamp: new Date(),
  });

  res.json({ success: true, data: serializeDraft(draft) });
});

const deleteDraft = asyncHandler(async (req, res) => {
  const draft = await Draft.findOne({ _id: req.params.id, userId: req.user._id });
  if (!draft) throw new ApiError(404, 'Draft not found');
  await draft.deleteOne();

  await Activity.create({
    userId: req.user._id,
    type: 'draft_deleted',
    title: draft.title,
    draftId: String(draft._id),
    description: 'Deleted a draft',
    timestamp: new Date(),
  });

  res.json({ success: true, message: 'Draft deleted' });
});

module.exports = {
  listDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
};
