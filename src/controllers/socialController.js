const Bookmark = require('../models/Bookmark');
const Follow = require('../models/Follow');
const Comment = require('../models/Comment');
const Message = require('../models/Message');
const Activity = require('../models/Activity');
const Poem = require('../models/Poem');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const {
  serializeComment,
  serializeMessage,
  serializeActivity,
} = require('../utils/serializers');

function toThreadId(otherId) {
  return `thread_${otherId}`;
}

function currentUserFrontendId(user) {
  const base = user.profile?.handle || user.profile?.name || user.fullName || String(user._id);
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const listBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await Bookmark.find({ userId: req.user._id }).sort({ createdAt: -1 });
  const data = bookmarks.map((b) => ({ id: b.poemId, ...b.poemSnapshot }));
  res.json({ success: true, data });
});

const toggleBookmark = asyncHandler(async (req, res) => {
  const { poem, poemId } = req.body || {};
  const normalizedPoemId = String(poemId || poem?.id || '');
  if (!normalizedPoemId) throw new ApiError(400, 'poemId is required');

  const existing = await Bookmark.findOne({ userId: req.user._id, poemId: normalizedPoemId });
  if (existing) {
    await existing.deleteOne();
    await Activity.create({
      userId: req.user._id,
      type: 'unbookmarked',
      title: existing.poemSnapshot?.title || '',
      poemId: normalizedPoemId,
      description: 'Removed a bookmark',
      timestamp: new Date(),
    });
    return res.json({ success: true, data: { bookmarked: false } });
  }

  let snapshot = poem || null;
  if (!snapshot) {
    const poemDoc = await Poem.findById(normalizedPoemId).catch(() => null);
    if (poemDoc) {
      snapshot = {
        id: String(poemDoc._id),
        title: poemDoc.title,
        previewContent: poemDoc.previewContent,
        fullContent: poemDoc.fullContent,
        author: poemDoc.author,
        category: poemDoc.category,
        likes: poemDoc.likes,
      };
    }
  }

  await Bookmark.create({
    userId: req.user._id,
    poemId: normalizedPoemId,
    poemSnapshot: snapshot || { id: normalizedPoemId },
  });
  await Activity.create({
    userId: req.user._id,
    type: 'bookmarked',
    title: snapshot?.title || '',
    poemId: normalizedPoemId,
    description: 'Bookmarked a poem',
    timestamp: new Date(),
  });

  res.json({ success: true, data: { bookmarked: true } });
});

const listFollows = asyncHandler(async (req, res) => {
  const follows = await Follow.find({ followerId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: follows.map((f) => f.followingId) });
});

const followUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) throw new ApiError(400, 'userId is required');
  await Follow.updateOne(
    { followerId: req.user._id, followingId: String(userId) },
    { $setOnInsert: { followerId: req.user._id, followingId: String(userId) } },
    { upsert: true }
  );
  res.json({ success: true, data: { following: true, userId: String(userId) } });
});

const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await Follow.deleteOne({ followerId: req.user._id, followingId: String(userId) });
  res.json({ success: true, data: { following: false, userId: String(userId) } });
});

const listComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ poemId: String(req.params.poemId) }).sort({ createdAt: 1 });
  res.json({ success: true, data: comments.map(serializeComment) });
});

const addComment = asyncHandler(async (req, res) => {
  const poemId = String(req.params.poemId || '');
  const body = String(req.body?.body || '').trim();
  if (!poemId) throw new ApiError(400, 'poemId is required');
  if (!body) throw new ApiError(400, 'Comment body is required');

  const authorId = req.body?.authorId || currentUserFrontendId(req.user);
  const authorName = req.user.profile?.name || req.user.fullName || 'You';
  const avatarUrl = req.user.profile?.avatarUrl || '';
  const comment = await Comment.create({
    poemId,
    authorId,
    userId: req.user._id,
    authorName,
    avatarUrl,
    body,
  });

  await Activity.create({
    userId: req.user._id,
    type: 'commented',
    title: body.slice(0, 40),
    poemId,
    description: 'Left a comment',
    timestamp: new Date(),
  });

  res.status(201).json({ success: true, data: serializeComment(comment) });
});

const getThread = asyncHandler(async (req, res) => {
  const recipientId = String(req.params.userId || '');
  const threadId = toThreadId(recipientId);
  const messages = await Message.find({
    senderUserId: req.user._id,
    threadId,
  }).sort({ createdAt: 1 });
  res.json({ success: true, data: messages.map(serializeMessage) });
});

const sendMessage = asyncHandler(async (req, res) => {
  const recipientId = String(req.params.userId || '');
  const body = String(req.body?.body || '').trim();
  if (!recipientId) throw new ApiError(400, 'recipientId is required');
  if (!body) throw new ApiError(400, 'Message body is required');

  const message = await Message.create({
    threadId: toThreadId(recipientId),
    senderId: req.body?.senderId || currentUserFrontendId(req.user),
    senderUserId: req.user._id,
    recipientId,
    body,
  });

  res.status(201).json({ success: true, data: serializeMessage(message) });
});

const listFavoriteAuthors = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.favoriteAuthors || [] });
});

const toggleFavoriteAuthor = asyncHandler(async (req, res) => {
  const authorName = String(req.body?.authorName || '').trim();
  if (!authorName) throw new ApiError(400, 'authorName is required');
  const exists = (req.user.favoriteAuthors || []).includes(authorName);
  req.user.favoriteAuthors = exists
    ? req.user.favoriteAuthors.filter((name) => name !== authorName)
    : [...(req.user.favoriteAuthors || []), authorName];
  await req.user.save();
  res.json({ success: true, data: { favorited: !exists, favoriteAuthors: req.user.favoriteAuthors } });
});

const listActivity = asyncHandler(async (req, res) => {
  const entries = await Activity.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(50);
  res.json({ success: true, data: entries.map(serializeActivity) });
});

const addActivity = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  if (!payload.type) throw new ApiError(400, 'type is required');
  const entry = await Activity.create({
    userId: req.user._id,
    type: payload.type,
    title: payload.title || '',
    poemId: payload.poemId || '',
    draftId: payload.draftId || '',
    description: payload.description || '',
    category: payload.category || '',
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
  });
  res.status(201).json({ success: true, data: serializeActivity(entry) });
});

module.exports = {
  listBookmarks,
  toggleBookmark,
  listFollows,
  followUser,
  unfollowUser,
  listComments,
  addComment,
  getThread,
  sendMessage,
  listFavoriteAuthors,
  toggleFavoriteAuthor,
  listActivity,
  addActivity,
};
