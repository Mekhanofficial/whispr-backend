const Poem = require('../models/Poem');
const UploadAsset = require('../models/UploadAsset');
const Activity = require('../models/Activity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { serializePoem } = require('../utils/serializers');

const POETRY_DB_RANDOM_URL = 'https://poetrydb.org/random/1';
let dailyQuoteCache = {
  dateKey: '',
  payload: null,
};

function buildPreview(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 160)}...`;
}

async function normalizeAudio(audio, userId) {
  if (audio === undefined) return undefined;
  if (!audio || !audio.assetId) return { assetId: null, url: '', durationMs: 0 };
  const asset = await UploadAsset.findOne({ _id: audio.assetId, userId });
  if (!asset) throw new ApiError(400, 'Audio upload was not found for this account');
  if (!String(asset.mimeType || '').toLowerCase().startsWith('audio/')) throw new ApiError(400, 'The selected upload is not an audio file');
  return { assetId: asset._id, url: asset.url, durationMs: Math.max(0, Number(audio.durationMs) || 0) };
}

function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function pickQuoteTextFromLines(lines = []) {
  const cleanLines = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line ?? '').trim())
    .filter(Boolean);

  if (!cleanLines.length) return '';

  const preferred = cleanLines.find((line) => line.length >= 18 && line.length <= 180);
  if (preferred) return preferred;

  const joined = cleanLines.slice(0, 2).join(' ').trim();
  return joined.length <= 200 ? joined : buildPreview(joined);
}

async function fetchPoetryDbDailyQuote() {
  let response;
  try {
    response = await fetch(POETRY_DB_RANDOM_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    const err = new Error('Unable to reach PoetryDB for daily quote.');
    err.code = 'POETRYDB_UNREACHABLE';
    err.cause = error;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`PoetryDB daily quote request failed (${response.status})`);
    err.code = 'POETRYDB_HTTP_ERROR';
    err.status = response.status;
    throw err;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    const err = new Error('PoetryDB daily quote response was invalid.');
    err.code = 'POETRYDB_INVALID_JSON';
    err.cause = error;
    throw err;
  }

  const rawPoem = Array.isArray(payload) ? payload[0] : null;
  if (!rawPoem) {
    throw new Error('PoetryDB returned no poem for daily quote.');
  }

  const title = String(rawPoem.title || 'Untitled').trim();
  const author = String(rawPoem.author || 'Unknown').trim();
  const lines = Array.isArray(rawPoem.lines) ? rawPoem.lines : [];
  const text = pickQuoteTextFromLines(lines) || title;

  return {
    title,
    author,
    text,
    source: 'poetrydb',
  };
}

async function buildDailyQuotePayload() {
  const todayKey = getUtcDateKey();
  if (dailyQuoteCache.dateKey === todayKey && dailyQuoteCache.payload) {
    return dailyQuoteCache.payload;
  }

  try {
    const quote = await fetchPoetryDbDailyQuote();
    const payload = {
      ...quote,
      dateKey: todayKey,
      fetchedAt: new Date().toISOString(),
    };
    dailyQuoteCache = { dateKey: todayKey, payload };
    return payload;
  } catch (error) {
    if (dailyQuoteCache.payload) {
      return {
        ...dailyQuoteCache.payload,
        stale: true,
      };
    }

    // Fallback to a real poem from the app database (not dummy seeds).
    const fallbackPoem = await Poem.findOne({ isPublic: true, source: { $ne: 'seed' } })
      .sort({ createdAt: -1 })
      .lean();

    if (fallbackPoem) {
      const payload = {
        title: fallbackPoem.title || 'Untitled',
        author: fallbackPoem.author || 'Unknown',
        text: buildPreview(fallbackPoem.fullContent || fallbackPoem.previewContent || fallbackPoem.title || ''),
        source: 'backend_fallback',
        dateKey: todayKey,
        fetchedAt: new Date().toISOString(),
      };
      dailyQuoteCache = { dateKey: todayKey, payload };
      return payload;
    }

    throw error;
  }
}

async function ensureSeedPoems() {
  // Legacy compatibility: this app no longer seeds dummy poems.
  // If old seed poems exist from a previous version, remove them.
  await Poem.deleteMany({ source: 'seed' });
}

const listPublicPoems = asyncHandler(async (req, res) => {
  await ensureSeedPoems();
  const { category, q } = req.query || {};
  const page = Math.max(1, Number(req.query?.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 20));
  const filter = { isPublic: true, source: { $ne: 'seed' } };
  if (category && category !== 'All') {
    filter.category = category;
  }
  if (q) {
    const regex = new RegExp(String(q).trim(), 'i');
    filter.$or = [{ title: regex }, { author: regex }, { previewContent: regex }, { fullContent: regex }];
  }
  const [poems, total] = await Promise.all([
    Poem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Poem.countDocuments(filter),
  ]);
  res.json({ success: true, data: { poems: poems.map(serializePoem), page, limit, total, hasMore: page * limit < total } });
});

const listMyPoems = asyncHandler(async (req, res) => {
  const poems = await Poem.find({ authorId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: poems.map(serializePoem) });
});

const getPoem = asyncHandler(async (req, res) => {
  const poem = await Poem.findById(req.params.id);
  if (!poem) throw new ApiError(404, 'Poem not found');
  if (!poem.isPublic && String(poem.authorId) !== String(req.user?._id || '')) {
    throw new ApiError(403, 'Not allowed');
  }
  res.json({ success: true, data: serializePoem(poem) });
});

const createPoem = asyncHandler(async (req, res) => {
  const { title, body, category, mood, promptId, audio, visibility, clientMutationId } = req.body || {};
  if (!title?.trim()) throw new ApiError(400, 'Title is required');
  if (!body?.trim()) throw new ApiError(400, 'Poem body is required');
  if (clientMutationId !== undefined && !/^[A-Za-z0-9_-]{12,96}$/.test(String(clientMutationId))) {
    throw new ApiError(400, 'Invalid client mutation ID');
  }
  if (clientMutationId) {
    const existing = await Poem.findOne({ authorId: req.user._id, clientMutationId });
    if (existing) return res.json({ success: true, data: serializePoem(existing) });
  }

  const normalizedAudio = await normalizeAudio(audio, req.user._id);
  let poem;
  try {
    poem = await Poem.create({
    authorId: req.user._id,
    author: req.user.profile?.name || req.user.fullName,
    title: title.trim(),
    fullContent: body.trim(),
    previewContent: buildPreview(body),
    category: category?.trim() || 'All',
    isPublic: visibility !== 'only_me',
    visibility: visibility === 'only_me' ? 'only_me' : 'public',
    mood: String(mood || '').trim(),
    promptId: promptId || null,
    ...(normalizedAudio !== undefined ? { audio: normalizedAudio } : {}),
    source: 'user',
    likes: 0,
    ...(clientMutationId ? { clientMutationId } : {}),
    });
  } catch (error) {
    if (error?.code === 11000 && clientMutationId) {
      const existing = await Poem.findOne({ authorId: req.user._id, clientMutationId });
      if (existing) return res.json({ success: true, data: serializePoem(existing) });
    }
    throw error;
  }

  await Activity.create({
    userId: req.user._id,
    type: 'published',
    title: poem.title,
    poemId: String(poem._id),
    description: 'Published a new poem',
    category: poem.category,
    timestamp: new Date(),
  });

  res.status(201).json({ success: true, data: serializePoem(poem) });
});

const updatePoem = asyncHandler(async (req, res) => {
  const poem = await Poem.findById(req.params.id);
  if (!poem) throw new ApiError(404, 'Poem not found');
  if (String(poem.authorId) !== String(req.user._id)) throw new ApiError(403, 'Not allowed');

  const { title, body, category, mood, promptId, audio, isPublic, visibility } = req.body || {};
  if (title !== undefined) poem.title = String(title).trim();
  if (body !== undefined) {
    poem.fullContent = String(body);
    poem.previewContent = buildPreview(body);
  }
  if (category !== undefined) poem.category = String(category || 'All');
  if (mood !== undefined) poem.mood = String(mood || '').trim();
  if (promptId !== undefined) poem.promptId = promptId || null;
  if (audio !== undefined) poem.audio = await normalizeAudio(audio, req.user._id);
  if (visibility !== undefined) { poem.visibility = visibility === 'only_me' ? 'only_me' : 'public'; poem.isPublic = poem.visibility === 'public'; }
  if (isPublic !== undefined) poem.isPublic = Boolean(isPublic);

  await poem.save();
  res.json({ success: true, data: serializePoem(poem) });
});

const deletePoem = asyncHandler(async (req, res) => {
  const poem = await Poem.findById(req.params.id);
  if (!poem) throw new ApiError(404, 'Poem not found');
  if (String(poem.authorId) !== String(req.user._id)) throw new ApiError(403, 'Not allowed');
  await poem.deleteOne();
  res.json({ success: true, message: 'Poem deleted' });
});

const toggleLike = asyncHandler(async (req, res) => {
  const poem = await Poem.findById(req.params.id);
  if (!poem) throw new ApiError(404, 'Poem not found');
  const userId = String(req.user._id);
  const liked = poem.likedBy.some((id) => String(id) === userId);
  if (liked) {
    poem.likedBy = poem.likedBy.filter((id) => String(id) !== userId);
    poem.likes = Math.max(0, Number(poem.likes || 0) - 1);
  } else {
    poem.likedBy.push(req.user._id);
    poem.likes = Number(poem.likes || 0) + 1;
  }
  await poem.save();
  res.json({ success: true, data: { liked: !liked, likes: poem.likes } });
});

const setLike = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const filter = req.method === 'DELETE'
    ? { _id: req.params.id, likedBy: userId }
    : { _id: req.params.id, likedBy: { $ne: userId } };
  const update = req.method === 'DELETE'
    ? { $pull: { likedBy: userId }, $inc: { likes: -1 } }
    : { $addToSet: { likedBy: userId }, $inc: { likes: 1 } };
  await Poem.updateOne(filter, update);
  const poem = await Poem.findById(req.params.id);
  if (!poem) throw new ApiError(404, 'Poem not found');
  res.json({ success: true, data: {
    liked: poem.likedBy.some((id) => String(id) === String(userId)),
    likes: Math.max(0, Number(poem.likes || 0)),
  } });
});

const getDailyQuote = asyncHandler(async (req, res) => {
  const payload = await buildDailyQuotePayload();
  res.json({ success: true, data: payload });
});

module.exports = {
  listPublicPoems,
  listMyPoems,
  getPoem,
  getDailyQuote,
  createPoem,
  updatePoem,
  deletePoem,
  toggleLike,
  setLike,
  ensureSeedPoems,
};
