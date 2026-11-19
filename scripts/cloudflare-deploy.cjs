#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Set the variable in Node, not in shell syntax, so npm works on Windows CMD
// as well as Unix shells. Wrangler's config runs the verified build hook.
const wrangler = path.join(__dirname, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const result = spawnSync(process.execPath, [wrangler, 'deploy', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, OPEN_NEXT_DEPLOY: 'true' },
});
if (result.error) console.error(`Could not start Wrangler: ${result.error.message}`);
if (result.signal) console.error(`Wrangler terminated by signal ${result.signal}`);
process.exitCode = result.status ?? 1;
