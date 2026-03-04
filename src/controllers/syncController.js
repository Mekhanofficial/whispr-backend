const User = require('../models/User');
const Poem = require('../models/Poem');
const Draft = require('../models/Draft');
const Bookmark = require('../models/Bookmark');
const Follow = require('../models/Follow');
const Comment = require('../models/Comment');
const Message = require('../models/Message');
const Activity = require('../models/Activity');
const { buildUserCards } = require('./userController');
const { ensureSeedPoems } = require('./poemController');
const asyncHandler = require('../utils/asyncHandler');
const {
  serializePoem,
  serializeDraft,
  serializeComment,
  serializeMessage,
  serializeActivity,
} = require('../utils/serializers');

const bootstrap = asyncHandler(async (req, res) => {
  await ensureSeedPoems();

  const [userPoems, drafts, bookmarks, follows, comments, messages, activity, users] = await Promise.all([
    Poem.find({ authorId: req.user._id }).sort({ createdAt: -1 }),
    Draft.find({ userId: req.user._id }).sort({ updatedAt: -1 }),
    Bookmark.find({ userId: req.user._id }).sort({ createdAt: -1 }),
    Follow.find({ followerId: req.user._id }).sort({ createdAt: -1 }),
    Comment.find({}).sort({ createdAt: 1 }).limit(1000),
    Message.find({ senderUserId: req.user._id }).sort({ createdAt: 1 }).limit(1000),
    Activity.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(50),
    User.find({}).sort({ createdAt: -1 }),
  ]);

  const usersCards = await buildUserCards(users);
  const commentsByPoem = comments.reduce((acc, comment) => {
    const key = String(comment.poemId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(serializeComment(comment));
    return acc;
  }, {});

  const messageThreads = messages.reduce((acc, msg) => {
    const key = msg.threadId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(serializeMessage(msg));
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      profile: req.user.profile || {},
      user: req.user.toSafeObject(),
      userPoems: userPoems.map(serializePoem),
      drafts: drafts.map(serializeDraft),
      bookmarks: bookmarks.map((b) => ({ id: b.poemId, ...b.poemSnapshot })),
      users: usersCards,
      follows: follows.map((f) => f.followingId),
      comments: commentsByPoem,
      messages: messageThreads,
      activity: activity.map(serializeActivity),
      favoriteAuthors: req.user.favoriteAuthors || [],
      settings: req.user.settings || {},
      vaultSettings: req.user.vaultSettings || {},
    },
  });
});

module.exports = {
  bootstrap,
};
