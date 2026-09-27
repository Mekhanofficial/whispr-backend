const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const Poem = require('../src/models/Poem');
const Activity = require('../src/models/Activity');
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
