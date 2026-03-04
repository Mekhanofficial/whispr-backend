function timeAgo(isoDate) {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return 'Just now';
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return 'Just now';
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function toId(docOrId) {
  if (!docOrId) return '';
  if (typeof docOrId === 'string') return docOrId;
  if (docOrId._id) return String(docOrId._id);
  return String(docOrId);
}

function serializePoem(doc) {
  return {
    id: toId(doc),
    title: doc.title,
    previewContent: doc.previewContent,
    fullContent: doc.fullContent,
    author: doc.author,
    time: timeAgo(doc.createdAt),
    category: doc.category || 'All',
    likes: Number(doc.likes || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    source: doc.source || 'user',
  };
}

function serializeDraft(doc) {
  return {
    id: toId(doc),
    title: doc.title || 'Untitled Draft',
    body: doc.body || '',
    category: doc.category || '',
    lastEdited: doc.lastEdited || timeAgo(doc.updatedAt),
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  };
}

function serializeComment(doc) {
  return {
    id: toId(doc),
    poemId: doc.poemId,
    authorId: doc.authorId,
    authorName: doc.authorName,
    avatarUrl: doc.avatarUrl || '',
    body: doc.body,
    createdAt: doc.createdAt,
  };
}

function serializeMessage(doc) {
  return {
    id: toId(doc),
    threadId: doc.threadId,
    senderId: doc.senderId,
    recipientId: doc.recipientId,
    body: doc.body,
    createdAt: doc.createdAt,
  };
}

function serializeActivity(doc) {
  return {
    id: toId(doc),
    type: doc.type,
    title: doc.title || '',
    poemId: doc.poemId || '',
    draftId: doc.draftId || '',
    description: doc.description || '',
    category: doc.category || '',
    timestamp: doc.timestamp || doc.createdAt,
  };
}

function serializeVaultItem(doc) {
  return {
    id: doc.itemId || toId(doc),
    name: doc.name,
    type: doc.type || 'file',
    size: Number(doc.size || 0),
    mimeType: doc.mimeType || '',
    uri: doc.uri || '',
    thumbnailUri: doc.thumbnailUri || '',
    source: doc.source || 'import',
    durationMs: Number(doc.durationMs || 0),
    categoryHint: doc.categoryHint || '',
    createdAt: doc.createdAtIso || doc.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: doc.updatedAtIso || doc.updatedAt?.toISOString?.() || new Date().toISOString(),
    isDecoy: Boolean(doc.isDecoy),
  };
}

module.exports = {
  timeAgo,
  serializePoem,
  serializeDraft,
  serializeComment,
  serializeMessage,
  serializeActivity,
  serializeVaultItem,
};
