const User = require('../models/User');
const Follow = require('../models/Follow');
const asyncHandler = require('../utils/asyncHandler');

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function buildUserCards(users) {
  const ids = users.map((user) => slugify(user.profile?.handle || user.profile?.name || user.fullName || String(user._id)));
  const [followersAgg, followingAgg] = await Promise.all([
    Follow.aggregate([
      { $match: { followingId: { $in: ids } } },
      { $group: { _id: '$followingId', count: { $sum: 1 } } },
    ]),
    Follow.aggregate([
      { $match: { followerId: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$followerId', count: { $sum: 1 } } },
    ]),
  ]);

  const followersMap = new Map(followersAgg.map((x) => [x._id, x.count]));
  const followingMap = new Map(followingAgg.map((x) => [String(x._id), x.count]));

  return users.map((user) => {
    const frontendId = slugify(user.profile?.handle || user.profile?.name || user.fullName || String(user._id));
    const handle =
      user.profile?.handle ||
      `@${slugify(user.profile?.name || user.fullName || 'writer').replace(/-/g, '') || 'writer'}`;
    return {
      id: frontendId,
      mongoId: String(user._id),
      name: user.profile?.name || user.fullName,
      handle,
      bio: user.profile?.bio || 'Poet & Writer',
      avatarUrl: user.profile?.avatarUrl || '',
      verified: Boolean(user.profile?.verified),
      followersCount: followersMap.get(frontendId) || 0,
      followingCount: followingMap.get(String(user._id)) || 0,
    };
  });
}

function buildFallbackCardFromId(frontendId = '') {
  const normalized = String(frontendId || '').trim();
  const readable = normalized
    .replace(/^@/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return {
    id: normalized || `user-${Date.now()}`,
    mongoId: null,
    name: readable || 'Writer',
    handle: normalized.startsWith('@') ? normalized : `@${normalized.replace(/[^a-z0-9]/gi, '') || 'writer'}`,
    bio: 'Poet & Writer',
    avatarUrl: '',
    verified: false,
    followersCount: 0,
    followingCount: 0,
    synthetic: true,
  };
}

async function getAllUsersAndCards() {
  const users = await User.find().sort({ createdAt: -1 });
  const cards = await buildUserCards(users);
  return { users, cards };
}

function findUserByIdOrMongo(users, cards, id) {
  const value = String(id || '');
  const card = cards.find((u) => u.id === value || u.mongoId === value);
  if (!card) return { user: null, card: null };
  const user = users.find((u) => String(u._id) === String(card.mongoId));
  return { user: user || null, card };
}

const listUsers = asyncHandler(async (req, res) => {
  const { cards } = await getAllUsersAndCards();
  res.json({ success: true, data: cards });
});

const getUser = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { cards } = await getAllUsersAndCards();
  const match = cards.find((u) => u.id === id || u.mongoId === id);
  if (!match) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, data: match });
});

const listFollowers = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { users, cards } = await getAllUsersAndCards();
  const { card: targetCard } = findUserByIdOrMongo(users, cards, id);
  if (!targetCard) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const follows = await Follow.find({ followingId: targetCard.id })
    .sort({ createdAt: -1 })
    .populate('followerId');

  const followerUsers = follows
    .map((follow) => follow.followerId)
    .filter(Boolean);

  const followerCards = followerUsers.length ? await buildUserCards(followerUsers) : [];
  const byMongoId = new Map(followerCards.map((card) => [String(card.mongoId), card]));
  const ordered = follows
    .map((follow) => byMongoId.get(String(follow.followerId?._id)))
    .filter(Boolean);

  res.json({ success: true, data: ordered });
});

const listFollowing = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { users, cards } = await getAllUsersAndCards();
  const { user: targetUser } = findUserByIdOrMongo(users, cards, id);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const follows = await Follow.find({ followerId: targetUser._id }).sort({ createdAt: -1 }).lean();
  const followedIds = follows.map((follow) => String(follow.followingId));
  const cardMap = new Map(cards.map((card) => [String(card.id), card]));
  const ordered = followedIds.map((followedId) => cardMap.get(followedId) || buildFallbackCardFromId(followedId));

  res.json({ success: true, data: ordered });
});

const updateMe = asyncHandler(async (req, res) => {
  const allowedProfileKeys = ['name', 'handle', 'bio', 'location', 'avatarUrl', 'verified', 'since'];
  const allowedSettingsKeys = ['notifications', 'appearance', 'privacy'];
  const body = req.body || {};

  if (body.fullName) {
    req.user.fullName = String(body.fullName).trim();
  }

  if (body.profile && typeof body.profile === 'object') {
    for (const key of allowedProfileKeys) {
      if (body.profile[key] !== undefined) {
        req.user.profile[key] = body.profile[key];
      }
    }
  }

  if (body.settings && typeof body.settings === 'object') {
    for (const group of allowedSettingsKeys) {
      if (body.settings[group] && typeof body.settings[group] === 'object') {
        req.user.settings[group] = {
          ...req.user.settings[group],
          ...body.settings[group],
        };
      }
    }
  }

  if (Array.isArray(body.favoriteAuthors)) {
    req.user.favoriteAuthors = body.favoriteAuthors.map(String);
  }

  if (body.vaultSettings && typeof body.vaultSettings === 'object') {
    req.user.vaultSettings = {
      ...req.user.vaultSettings,
      ...body.vaultSettings,
    };
  }

  await req.user.save();
  res.json({ success: true, data: req.user.toSafeObject() });
});

module.exports = {
  listUsers,
  getUser,
  listFollowers,
  listFollowing,
  updateMe,
  buildUserCards,
};
