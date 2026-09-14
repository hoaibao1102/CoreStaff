/** Catch-all so /api/healthz hits this function, not a missing api/healthz.js. */
module.exports = require('./index.js');
