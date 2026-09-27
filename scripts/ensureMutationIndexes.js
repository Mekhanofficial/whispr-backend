const mongoose = require('mongoose');
const env = require('../src/config/env');
const Poem = require('../src/models/Poem');
const Comment = require('../src/models/Comment');

async function main() {
  if (!env.mongoUri) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(env.mongoUri);
  try {
    await Poem.createIndexes();
    await Comment.createIndexes();
    process.stdout.write('Poem and comment mutation indexes are present.\n');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Could not ensure mutation indexes:', error?.message || error);
  process.exitCode = 1;
});
