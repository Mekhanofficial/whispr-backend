const ApiError = require('./ApiError');

function normalizePoemKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length > 512 || /[\r\n]/.test(key)) throw new ApiError(400, 'A valid poem key is required');
  return key.includes(':') ? key : `whispr:${key}`;
}

module.exports = { normalizePoemKey };
