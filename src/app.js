const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const env = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const uploadsDir = path.isAbsolute(env.uploadDir)
  ? env.uploadDir
  : path.resolve(__dirname, '..', env.uploadDir);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: env.clientOrigin === '*' ? true : env.clientOrigin.split(',').map((v) => v.trim()),
    credentials: false,
  })
);
app.use(express.json({ limit: '2mb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/uploads', (req, res, next) => {
  let firstSegment;
  try {
    firstSegment = decodeURIComponent(req.path).split('/').filter(Boolean)[0] || '';
  } catch {
    return res.sendStatus(404);
  }
  if (/^(vault|private)(?:[_-]|$)/i.test(firstSegment.replace(/^_+/, ''))) {
    return res.sendStatus(404);
  }
  return next();
}, express.static(uploadsDir));
app.use('/api', apiRoutes);


app.use(notFound);
app.use(errorHandler);

module.exports = app;
