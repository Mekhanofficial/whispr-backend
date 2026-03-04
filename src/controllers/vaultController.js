const VaultItem = require('../models/VaultItem');
const VaultClone = require('../models/VaultClone');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { serializeVaultItem } = require('../utils/serializers');

function buildSummary(items) {
  const normalized = items.map(serializeVaultItem).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const totalFiles = normalized.length;
  const storageBytes = normalized.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  return {
    totalFiles,
    storageBytes,
    items: normalized,
    recent: normalized.slice(0, 12),
    lastAccess: normalized[0]?.updatedAt || null,
    counts: normalized.reduce(
      (acc, item) => {
        const type = item.type || 'file';
        if (type === 'image') acc.images += 1;
        else if (type === 'video') acc.videos += 1;
        else if (type === 'document') acc.documents += 1;
        else if (type === 'audio') acc.audio += 1;
        else if (type === 'note') acc.notes += 1;
        else acc.other += 1;
        return acc;
      },
      { images: 0, videos: 0, documents: 0, audio: 0, notes: 0, other: 0 }
    ),
  };
}

const listVaultItems = asyncHandler(async (req, res) => {
  const isDecoy = String(req.query.isDecoy || 'false') === 'true';
  const items = await VaultItem.find({ userId: req.user._id, isDecoy }).sort({ updatedAt: -1 });
  res.json({ success: true, data: items.map(serializeVaultItem) });
});

const upsertVaultItem = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const itemId = String(body.id || body.itemId || '');
  if (!itemId) throw new ApiError(400, 'item id is required');

  const doc = await VaultItem.findOneAndUpdate(
    { userId: req.user._id, isDecoy: Boolean(body.isDecoy), itemId },
    {
      $set: {
        name: body.name || 'Untitled',
        type: body.type || 'file',
        size: Number(body.size || 0),
        mimeType: body.mimeType || '',
        uri: body.uri || '',
        thumbnailUri: body.thumbnailUri || '',
        source: body.source || 'import',
        durationMs: Number(body.durationMs || 0),
        categoryHint: body.categoryHint || '',
        createdAtIso: body.createdAt || body.createdAtIso || new Date().toISOString(),
        updatedAtIso: body.updatedAt || body.updatedAtIso || new Date().toISOString(),
      },
      $setOnInsert: {
        userId: req.user._id,
        isDecoy: Boolean(body.isDecoy),
        itemId,
      },
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ success: true, data: serializeVaultItem(doc) });
});

const deleteVaultItem = asyncHandler(async (req, res) => {
  const isDecoy = String(req.query.isDecoy || 'false') === 'true';
  await VaultItem.deleteOne({ userId: req.user._id, isDecoy, itemId: String(req.params.itemId) });
  res.json({ success: true, message: 'Vault item deleted' });
});

const getVaultSummary = asyncHandler(async (req, res) => {
  const isDecoy = String(req.query.isDecoy || 'false') === 'true';
  const items = await VaultItem.find({ userId: req.user._id, isDecoy }).sort({ updatedAt: -1 });
  res.json({ success: true, data: buildSummary(items) });
});

const listVaultClones = asyncHandler(async (req, res) => {
  const clones = await VaultClone.find({ userId: req.user._id }).sort({ updatedAt: -1 });
  res.json({ success: true, data: clones.map((clone) => ({
    id: clone.cloneId,
    cloneId: clone.cloneId,
    alias: clone.alias,
    name: clone.name,
    package: clone.package,
    icon: clone.icon,
    createdAt: clone.createdAt,
    updatedAt: clone.updatedAt,
    lastLaunchedAt: clone.lastLaunchedAt,
    metadata: clone.metadata || {},
  })) });
});

const createVaultClone = asyncHandler(async (req, res) => {
  const { cloneId, alias, name, package: packageName, icon, metadata } = req.body || {};
  if (!cloneId || !packageName) throw new ApiError(400, 'cloneId and package are required');
  const clone = await VaultClone.findOneAndUpdate(
    { userId: req.user._id, cloneId: String(cloneId) },
    {
      $set: {
        alias: alias || '',
        name: name || alias || '',
        package: String(packageName),
        icon: icon || '',
        metadata: metadata || {},
      },
      $setOnInsert: {
        userId: req.user._id,
        cloneId: String(cloneId),
      },
    },
    { upsert: true, new: true }
  );
  res.status(201).json({ success: true, data: clone });
});

const removeVaultClone = asyncHandler(async (req, res) => {
  await VaultClone.deleteOne({ userId: req.user._id, cloneId: String(req.params.cloneId) });
  res.json({ success: true, message: 'Clone removed' });
});

const updateVaultSettings = asyncHandler(async (req, res) => {
  req.user.vaultSettings = {
    ...req.user.vaultSettings,
    ...(req.body || {}),
  };
  await req.user.save();
  res.json({ success: true, data: req.user.vaultSettings });
});

module.exports = {
  listVaultItems,
  upsertVaultItem,
  deleteVaultItem,
  getVaultSummary,
  listVaultClones,
  createVaultClone,
  removeVaultClone,
  updateVaultSettings,
};
