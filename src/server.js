const app = require('./app');
const env = require('./config/env');
const { connectDb } = require('./config/db');
const os = require('os');

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      urls.push(`http://${entry.address}:${port}`);
    }
  }

  return [...new Set(urls)];
}

async function start() {
  await connectDb(env.mongoUri);
  app.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      `Whispr backend listening on http://${env.host}:${env.port} (local: http://localhost:${env.port})`
    );
    const lanUrls = getLanUrls(env.port);
    if (lanUrls.length) {
      // eslint-disable-next-line no-console
      console.log(`LAN URLs: ${lanUrls.join(', ')}`);
    }
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start backend:', error);
  process.exit(1);
});
