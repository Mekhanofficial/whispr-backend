const Like = require('../models/Like');
const Bookmark = require('../models/Bookmark');
const Comment = require('../models/Comment');
const asyncHandler = require('../utils/asyncHandler');
const { normalizePoemKey } = require('../utils/poemIdentity');

const batchEngagement = asyncHandler(async (req, res) => {
  const poemKeys = [...new Set((Array.isArray(req.body?.poemKeys) ? req.body.poemKeys : []).map(normalizePoemKey))].slice(0, 100);
  const [likes, comments, bookmarks] = await Promise.all([
    Like.aggregate([{ $match: { poemKey: { $in: poemKeys } } }, { $group: { _id: '$poemKey', count: { $sum: 1 } } }]),
    Comment.aggregate([{ $match: { poemKey: { $in: poemKeys } } }, { $group: { _id: '$poemKey', count: { $sum: 1 } } }]),
    Bookmark.find({ userId: req.user._id, poemId: { $in: poemKeys } }).select('poemId').lean(),
  ]);
  const liked = await Like.find({ userId: req.user._id, poemKey: { $in: poemKeys } }).select('poemKey').lean();
  const likeCounts = new Map(likes.map((item) => [item._id, item.count]));
  const commentCounts = new Map(comments.map((item) => [item._id, item.count]));
  const likedKeys = new Set(liked.map((item) => item.poemKey));
  const bookmarkedKeys = new Set(bookmarks.map((item) => item.poemId));
  const data = Object.fromEntries(poemKeys.map((key) => [key, {
    likeCount: likeCounts.get(key) || 0,
    commentCount: commentCounts.get(key) || 0,
    likedByMe: likedKeys.has(key),
    bookmarkedByMe: bookmarkedKeys.has(key),
  }]));
  res.json({ success: true, data });
});

const setLike = asyncHandler(async (req, res) => {
  const poemKey = normalizePoemKey(req.params.poemKey);
  const liked = req.method !== 'DELETE';
  if (liked) {
    try { await Like.create({ userId: req.user._id, poemKey }); } catch (error) { if (error?.code !== 11000) throw error; }
  } else {
    await Like.deleteOne({ userId: req.user._id, poemKey });
  }
  const likeCount = await Like.countDocuments({ poemKey });
  res.json({ success: true, data: { liked, likeCount, likes: likeCount, poemKey } });
});

module.exports = { normalizePoemKey, batchEngagement, setLike };
