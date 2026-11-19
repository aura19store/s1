#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

// These are build inputs, not credentials. Runtime uploads and all .env files
// are deliberately excluded. No source data or environment values are printed.
const inputDirectories = ['src', 'public', 'supabase', 'scripts'];
const inputFiles = ['package.json', 'package-lock.json', 'next.config.ts', 'open-next.config.ts', 'wrangler.jsonc'];

function fingerprintInputs(root) {
  const files = [];
  function visit(relative) {
    if (relative === 'public/uploads') return;
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Symlink in build inputs: ${relative}`);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolute).sort()) visit(path.posix.join(relative, entry));
    } else if (stat.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Unsupported build input: ${relative}`);
    }
  }
  for (const entry of [...inputDirectories, ...inputFiles]) visit(entry);
  const hash = createHash('sha256');
  for (const relative of files.sort()) {
    const bytes = fs.readFileSync(path.join(root, relative));
    hash.update(`${Buffer.byteLength(relative)}:${relative}:${bytes.length}:`);
    hash.update(bytes);
  }
  return hash.digest('hex');
}

function verifyArtifacts(root, fingerprint) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Invalid build fingerprint');
  const openNext = path.join(root, '.open-next');
  const assets = path.join(openNext, 'assets', '_next');
  const buildId = fs.readFileSync(path.join(root, '.next', 'BUILD_ID'), 'utf8').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(buildId)) throw new Error('Invalid Next.js build ID');
  for (const file of [path.join(openNext, 'worker.js'), path.join(assets, 'static', buildId, '_buildManifest.js')]) {
    if (!fs.statSync(file).isFile()) throw new Error('Missing current OpenNext artifact');
  }
  const worker = fs.readFileSync(path.join(openNext, 'worker.js'), 'utf8');
  if (!worker.includes('./server-functions/default/handler.mjs')) throw new Error('Worker does not reference the expected server handler');
  const handler = fs.readFileSync(path.join(openNext, 'server-functions/default/handler.mjs'), 'utf8');
  for (const marker of ['23001', 'SQLITE_CONSTRAINT_FOREIGNKEY', 'CURRENT_TIMESTAMP IS NOT NULL']) {
    if (!handler.includes(marker)) throw new Error('Expected current server code missing from bundled handler');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.next', 'app-build-manifest.json'), 'utf8'));
  function routeText(route) {
    const files = manifest.pages?.[route];
    if (!Array.isArray(files) || files.length === 0) throw new Error(`Missing route in build: ${route}`);
    return files.filter(file => file.endsWith('.js')).map(file => {
      if (!/^static\/[A-Za-z0-9_./()\-]+\.js$/.test(file) || file.split('/').includes('..')) throw new Error('Invalid asset path in build manifest');
      return fs.readFileSync(path.join(assets, file), 'utf8');
    }).join('\n');
  }
  const required = [
    ['/admin/(panel)/layout', fingerprint],
    ['/admin/(panel)/products/page', 'تعذر تأكيد حالة المنتج'],
    ['/admin/(panel)/filters/page', 'تعذر تأكيد حفظ الفلتر'],
    ['/admin/(panel)/orders/page', 'تعذر تأكيد حذف الطلب'],
  ];
  for (const [route, marker] of required) {
    if (!routeText(route).includes(marker)) throw new Error(`Expected current admin code missing from ${route}`);
  }
  const orderApi = fs.readFileSync(path.join(openNext, 'server-functions', 'default', '.next', 'server', 'app', 'api', 'admin', 'orders', '[id]', 'route.js'), 'utf8');
  for (const marker of ['يمكن حذف الطلب الملغى فقط', '23001']) {
    if (!orderApi.includes(marker)) throw new Error('Expected order deletion API code is missing');
  }
  // The PDF is dynamically imported and is not necessarily in the orders page chunk.
  function anyJsContains(dir, marker) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && anyJsContains(full, marker)) return true;
      if (entry.isFile() && entry.name.endsWith('.js') && fs.readFileSync(full, 'utf8').includes(marker)) return true;
    }
    return false;
  }
  if (!anyJsContains(path.join(assets, 'static', 'chunks'), 'المجموع الفرعي بعد الخصم')) {
    throw new Error('Expected order PDF code is missing');
  }
}

function main() {
  const root = process.cwd();
  const lock = path.join(root, '.open-next-build.lock');
  fs.mkdirSync(lock); // Fail closed if another verified build is running or left a stale lock.
  try {
    const before = fingerprintInputs(root);
    // Never allow the build to fall back to an older generated tree.
    fs.rmSync(path.join(root, '.open-next'), { recursive: true, force: true });
    fs.rmSync(path.join(root, '.next'), { recursive: true, force: true });
    const cli = path.join(root, 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'index.js');
    const result = spawnSync(process.execPath, [cli, 'build'], {
      cwd: root,
      env: { ...process.env, NEXT_PUBLIC_AURA_BUILD_FINGERPRINT: before },
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`OpenNext build failed${result.signal ? ` (${result.signal})` : ''}`);
    if (fingerprintInputs(root) !== before) throw new Error('Build inputs changed while building; refusing deployment');
    verifyArtifacts(root, before);
    console.log('Verified: fresh OpenNext build, matching input fingerprint, admin routes, order API and PDF.');
  } finally {
    fs.rmdirSync(lock);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`Cloudflare build verification failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { fingerprintInputs, verifyArtifacts };
