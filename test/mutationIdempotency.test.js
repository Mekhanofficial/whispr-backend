const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const Comment = require('../src/models/Comment');
const Activity = require('../src/models/Activity');
const Poem = require('../src/models/Poem');
const { addComment } = require('../src/controllers/socialController');
const { setLike } = require('../src/controllers/poemController');

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(value) { this.statusCode = value; return this; },
      json(value) { resolve({ status: this.statusCode, value }); return this; },
    };
    handler(req, res, reject);
  });
}

test('comment replay returns the original comment without a second activity', async () => {
  const oldFind = Comment.findOne;
  const oldCreate = Comment.create;
  const oldActivity = Activity.create;
  let created = null;
  let activities = 0;
  Comment.findOne = async () => created;
  Comment.create = async (input) => {
    created = { ...input, _id: 'comment-id', createdAt: new Date(), updatedAt: new Date() };
    return created;
  };
  Activity.create = async () => { activities++; };
  try {
    const req = { params: { poemId: 'poem-id' }, body: { body: 'Hello', clientMutationId: 'comment_retry_123' },
      user: { _id: 'author-id', fullName: 'Author', profile: { name: 'Author' } } };
    const first = await invoke(addComment, req);
    const second = await invoke(addComment, req);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.value.data.id, first.value.data.id);
    assert.equal(activities, 1);
  } finally {
    Comment.findOne = oldFind;
    Comment.create = oldCreate;
    Activity.create = oldActivity;
  }
});

test('desired like state is safe to replay', async () => {
  const oldUpdate = Poem.updateOne;
  const oldFind = Poem.findById;
  let liked = false;
  let changes = 0;
  Poem.updateOne = async (filter, update) => {
    if (filter.likedBy?.$ne && !liked) { liked = true; changes++; }
    if (!filter.likedBy?.$ne && liked) { liked = false; changes++; }
    assert.ok(update.$inc.likes === 1 || update.$inc.likes === -1);
  };
  Poem.findById = async () => ({ likedBy: liked ? ['author-id'] : [], likes: liked ? 1 : 0 });
  try {
    const req = { params: { id: 'poem-id' }, method: 'PUT', user: { _id: 'author-id' } };
    assert.equal((await invoke(setLike, req)).value.data.liked, true);
    assert.equal((await invoke(setLike, req)).value.data.liked, true);
    assert.equal(changes, 1);
  } finally {
    Poem.updateOne = oldUpdate;
    Poem.findById = oldFind;
  }
});
