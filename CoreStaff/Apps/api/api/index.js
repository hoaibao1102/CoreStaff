/** Vercel serverless entry — compiled Nest handler lives in dist/ after `npm run build`. */
module.exports = require('../dist/vercel.js').default;
