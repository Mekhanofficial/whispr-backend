const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');
const env = require('../src/config/env');

process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const Poem = require('../src/models/Poem');
const UploadAsset = require('../src/models/UploadAsset');
const { streamPoemAudio } = require('../src/controllers/poemController');

function stream(handler, req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const headers = {};
    const res = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    res.statusCode = 200;
    res.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
    res.status = (code) => { res.statusCode = code; return res; };
    res.sendStatus = (code) => { res.statusCode = code; res.end(); return res; };
    res.on('finish', () => resolve({ status: res.statusCode, headers, body: Buffer.concat(chunks) }));
    handler(req, res, reject);
  });
}

function privatePoem(ownerId = 'owner-id') {
  return { _id: 'poem-id', authorId: ownerId, visibility: 'only_me', isPublic: false, audio: { assetId: 'audio-id' } };
}

test('private and draft-style audio deny unauthenticated and other users', async () => {
  const originalFind = Poem.findById;
  Poem.findById = async () => privatePoem();
  try {
    await assert.rejects(stream(streamPoemAudio, { params: { id: 'poem-id' }, headers: {} }), (error) => error.statusCode === 401);
    await assert.rejects(stream(streamPoemAudio, { params: { id: 'poem-id' }, headers: {}, user: { _id: 'other-id' } }), (error) => error.statusCode === 403);
    Poem.findById = async () => ({ ...privatePoem(), visibility: 'public', isPublic: false });
    await assert.rejects(stream(streamPoemAudio, { params: { id: 'poem-id' }, headers: {}, user: { _id: 'other-id' } }), (error) => error.statusCode === 403);
  } finally {
    Poem.findById = originalFind;
  }
});

test('owner private audio and public audio stream with byte ranges', async () => {
  const originalFind = Poem.findById;
  const originalAssetFind = UploadAsset.findById;
  const uploadsRoot = path.resolve(path.isAbsolute(env.uploadDir) ? env.uploadDir : path.resolve(__dirname, '..', env.uploadDir));
  const filePath = path.join(uploadsRoot, 'audio-access-test.bin');
  const relativePath = path.relative(path.dirname(uploadsRoot), filePath).replace(/\\/g, '/');
  fs.writeFileSync(filePath, Buffer.from('0123456789'));
  UploadAsset.findById = async () => ({ _id: 'audio-id', relativePath, mimeType: 'audio/mpeg' });
  try {
    Poem.findById = async () => privatePoem();
    const owner = await stream(streamPoemAudio, { params: { id: 'poem-id' }, headers: { range: 'bytes=2-5' }, user: { _id: 'owner-id' } });
    assert.equal(owner.status, 206);
    assert.equal(owner.headers['content-range'], 'bytes 2-5/10');
    assert.equal(owner.body.toString(), '2345');

    Poem.findById = async () => ({ ...privatePoem(), visibility: 'public', isPublic: true });
    const publicAudio = await stream(streamPoemAudio, { params: { id: 'poem-id' }, headers: {} });
    assert.equal(publicAudio.status, 200);
    assert.equal(publicAudio.body.toString(), '0123456789');
  } finally {
    Poem.findById = originalFind;
    UploadAsset.findById = originalAssetFind;
    fs.rmSync(filePath, { force: true });
  }
});
