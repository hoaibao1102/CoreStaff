'use strict';

/**
 * cPanel entry point — "Application Start" / "Application root" file.
 *
 * cPanel's Node selector (Passenger / CloudLinux Node.js Selector) requires a
 * JS file at the application root whose *absolute* path it invokes, and it sets
 * process.cwd() to that root — NOT to the app subdirectory. `dist/main.js`
 * loads `.env` via `path.resolve(process.cwd(), '.env')` (src/config/env.ts),
 * so without this shim the .env sitting next to server.js would never be found.
 *
 * Fixed up here, before any app code is required:
 *   1. chdir to this file's directory, so `Apps/api/.env` is the one that loads
 *   2. NODE_PATH -> the node_modules that actually holds the dependencies
 *      (Apps/api/node_modules, or — as in this npm-workspaces monorepo — the
 *      nearest one further up, e.g. CoreStaff/node_modules)
 *
 * Then hand over to the compiled Nest bootstrap, which listens on the PORT
 * Passenger injects.
 *
 * Layout overrides, both optional:
 *   APP_DIR    directory holding the build output   (default: <app root>/dist)
 *   APP_ENTRY  file to start inside APP_DIR         (default: main.js)
 */

const fs = require('node:fs');
const path = require('node:path');

const appRoot = __dirname;
const distDir = path.resolve(appRoot, process.env.APP_DIR || path.join('dist'));
const entry = path.join(distDir, process.env.APP_ENTRY || 'main.js');

process.chdir(appRoot);

function nearestNodeModules(from) {
  for (let dir = from; ; ) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const modules = nearestNodeModules(appRoot);
if (modules) {
  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${modules}${path.delimiter}${process.env.NODE_PATH}`
    : modules;
  require('node:module').Module._initPaths();
}

if (!fs.existsSync(entry)) {
  console.error(
    `[corestaff-api] missing ${entry} — run "npm run build" (nest build) before starting.`,
  );
  process.exit(1);
}

require(entry);
