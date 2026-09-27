const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const Poem = require('../src/models/Poem');
const Activity = require('../src/models/Activity');
const UploadAsset = require('../src/models/UploadAsset');
const { createPoem, updatePoem } = require('../src/controllers/poemController');

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, value }); return this; },
    };
    handler(req, res, reject);
  });
}

test('published poem retry with one mutation ID returns the existing poem', async () => {
  const originalFind = Poem.findOne;
  const originalCreate = Poem.create;
  const originalActivity = Activity.create;
  let created = null;
  let activityCount = 0;
  Poem.findOne = async () => created;
  Poem.create = async (input) => {
    created = { ...input, _id: 'poem-id', createdAt: new Date(), updatedAt: new Date() };
    return created;
  };
  Activity.create = async () => { activityCount++; };
  try {
    const request = {
      body: { title: 'Test', body: 'A short poem', category: 'Hope', clientMutationId: 'publish_retry_123' },
      user: { _id: 'author-id', fullName: 'Author', profile: { name: 'Author' } },
    };
    const first = await invoke(createPoem, request);
    const second = await invoke(createPoem, request);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.value.data.id, first.value.data.id);
    assert.equal(activityCount, 1);
  } finally {
    Poem.findOne = originalFind;
    Poem.create = originalCreate;
    Activity.create = originalActivity;
  }
});

test('published poem edit rejects a different owner', async () => {
  const originalFind = Poem.findById;
  let saveCount = 0;
  Poem.findById = async () => ({
    authorId: 'original-author',
    title: 'Original',
    async save() { saveCount++; },
  });
  try {
    await assert.rejects(
      invoke(updatePoem, { params: { id: 'poem-id' }, body: { title: 'Tampered' }, user: { _id: 'different-author' } }),
      (error) => error.statusCode === 403 || error.status === 403
    );
    assert.equal(saveCount, 0);
  } finally {
    Poem.findById = originalFind;
  }
});

test('Only Me poem is persisted as non-public private writing', async () => {
  const originalFind = Poem.findOne;
  const originalCreate = Poem.create;
  const originalActivity = Activity.create;
  let received;
  Poem.findOne = async () => null;
  Poem.create = async (input) => { received = input; return { ...input, _id: 'private-poem-id', createdAt: new Date(), updatedAt: new Date() }; };
  Activity.create = async () => {};
  try {
    const result = await invoke(createPoem, { body: { title: 'Private page', body: 'This stays with me.', visibility: 'only_me', clientMutationId: 'private_entry_123' }, user: { _id: 'author-id', fullName: 'Author', profile: { name: 'Author' } } });
    assert.equal(result.status, 201);
    assert.equal(received.visibility, 'only_me');
    assert.equal(received.isPublic, false);
  } finally {
    Poem.findOne = originalFind;
    Poem.create = originalCreate;
    Activity.create = originalActivity;
  }
});

test('Only Me visibility cannot be overridden by a legacy isPublic update value', async () => {
  const originalFind = Poem.findById;
  const poem = {
    authorId: 'author-id',
    visibility: 'public',
    isPublic: true,
    async save() {},
  };
  Poem.findById = async () => poem;
  try {
    const result = await invoke(updatePoem, {
      params: { id: 'poem-id' },
      body: { visibility: 'only_me', isPublic: true },
      user: { _id: 'author-id' },
    });
    assert.equal(result.status, 200);
    assert.equal(poem.visibility, 'only_me');
    assert.equal(poem.isPublic, false);
  } finally {
    Poem.findById = originalFind;
  }
});

test('voice-reading metadata accepts only the owner audio upload', async () => {
  const originalFind = Poem.findOne;
  const originalCreate = Poem.create;
  const originalAssetFind = UploadAsset.findOne;
  const originalActivity = Activity.create;
  let received;
  Poem.findOne = async () => null;
  UploadAsset.findOne = async () => ({ _id: 'audio-asset-id', userId: 'author-id', url: '/uploads/poem-audio/reading.m4a', mimeType: 'audio/mp4' });
  Poem.create = async (input) => { received = input; return { ...input, _id: 'audio-poem-id', createdAt: new Date(), updatedAt: new Date() }; };
  Activity.create = async () => {};
  try {
    const response = await invoke(createPoem, { body: { title: 'Read aloud', body: 'A voice follows the line.', audio: { assetId: 'audio-asset-id', durationMs: 4200 }, clientMutationId: 'audio_reading_123' }, user: { _id: 'author-id', fullName: 'Author', profile: { name: 'Author' } } });
    assert.equal(response.status, 201);
    assert.equal(received.audio.url, '/uploads/poem-audio/reading.m4a');
    assert.equal(received.audio.durationMs, 4200);
  } finally {
    Poem.findOne = originalFind;
    Poem.create = originalCreate;
    UploadAsset.findOne = originalAssetFind;
    Activity.create = originalActivity;
  }
});
