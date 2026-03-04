const Poem = require('../models/Poem');
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
  const filter = { isPublic: true, source: { $ne: 'seed' } };
  if (category && category !== 'All') {
    filter.category = category;
  }
  if (q) {
    const regex = new RegExp(String(q).trim(), 'i');
    filter.$or = [{ title: regex }, { author: regex }, { previewContent: regex }, { fullContent: regex }];
  }
  const poems = await Poem.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, data: poems.map(serializePoem) });
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
  const { title, body, category } = req.body || {};
  if (!title?.trim()) throw new ApiError(400, 'Title is required');
  if (!body?.trim()) throw new ApiError(400, 'Poem body is required');

  const poem = await Poem.create({
    authorId: req.user._id,
    author: req.user.profile?.name || req.user.fullName,
    title: title.trim(),
    fullContent: body.trim(),
    previewContent: buildPreview(body),
    category: category?.trim() || 'All',
    isPublic: true,
    source: 'user',
    likes: 0,
  });

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

  const { title, body, category, isPublic } = req.body || {};
  if (title !== undefined) poem.title = String(title).trim();
  if (body !== undefined) {
    poem.fullContent = String(body);
    poem.previewContent = buildPreview(body);
  }
  if (category !== undefined) poem.category = String(category || 'All');
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
  ensureSeedPoems,
};
