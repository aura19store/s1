const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fingerprintInputs, verifyArtifacts } = require('../scripts/cloudflare-build-verified.cjs');
const root = path.resolve(__dirname, '..');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-build-test-'));
  for (const name of ['src', 'public', 'supabase', 'scripts']) fs.mkdirSync(path.join(dir, name));
  for (const name of ['package.json', 'package-lock.json', 'next.config.ts', 'open-next.config.ts', 'wrangler.jsonc']) fs.writeFileSync(path.join(dir, name), name);
  const write = (name, content) => { const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  return { dir, write, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
function artifacts(f, hash) {
  f.write('.next/BUILD_ID', 'build123');
  const pages = {
    '/admin/(panel)/layout': ['static/layout.js'],
    '/admin/(panel)/products/page': ['static/products.js'],
    '/admin/(panel)/filters/page': ['static/filters.js'],
    '/admin/(panel)/orders/page': ['static/orders.js'],
  };
  f.write('.next/app-build-manifest.json', JSON.stringify({ pages }));
  f.write('.open-next/worker.js', './server-functions/default/handler.mjs');
  f.write('.open-next/server-functions/default/handler.mjs', '23001 SQLITE_CONSTRAINT_FOREIGNKEY CURRENT_TIMESTAMP IS NOT NULL');
  f.write('.open-next/assets/_next/static/build123/_buildManifest.js', 'manifest');
  f.write('.open-next/assets/_next/static/layout.js', hash);
  f.write('.open-next/assets/_next/static/products.js', 'تعذر تأكيد حالة المنتج');
  f.write('.open-next/assets/_next/static/filters.js', 'تعذر تأكيد حفظ الفلتر');
  f.write('.open-next/assets/_next/static/orders.js', 'تعذر تأكيد حذف الطلب');
  f.write('.open-next/assets/_next/static/chunks/pdf.js', 'المجموع الفرعي بعد الخصم');
  f.write('.open-next/server-functions/default/.next/server/app/api/admin/orders/[id]/route.js', 'يمكن حذف الطلب الملغى فقط 23001');
}

test('verified artifacts must contain the current input fingerprint and real admin features', () => {
  const f = fixture();
  try {
    const hash = fingerprintInputs(f.dir);
    artifacts(f, hash);
    assert.doesNotThrow(() => verifyArtifacts(f.dir, hash));
    f.write('src/change.ts', 'change');
    assert.throws(() => verifyArtifacts(f.dir, fingerprintInputs(f.dir)), /layout/);
    f.write('.open-next/assets/_next/static/filters.js', 'old filter');
    assert.throws(() => verifyArtifacts(f.dir, hash), /filters/);
    artifacts(f, hash);
    f.write('.open-next/server-functions/default/.next/server/app/api/admin/orders/[id]/route.js', 'old api');
    assert.throws(() => verifyArtifacts(f.dir, hash), /deletion API/);
    artifacts(f, hash);
    fs.rmSync(path.join(f.dir, '.open-next/assets/_next/static/chunks/pdf.js'));
    assert.throws(() => verifyArtifacts(f.dir, hash), /PDF/);
  } finally { f.cleanup(); }
});

test('failed build removes old output and returns failure', () => {
  const f = fixture();
  try {
    f.write('.open-next/worker.js', 'old');
    f.write('node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'process.exit(7)');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/cloudflare-build-verified.cjs')], { cwd: f.dir, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(path.join(f.dir, '.open-next/worker.js')), false);
    assert.equal(fs.existsSync(path.join(f.dir, '.open-next-build.lock')), false);
  } finally { f.cleanup(); }
});

test('changing inputs during a successful build fails closed', () => {
  const f = fixture();
  try {
    f.write('node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'require("fs").writeFileSync("src/changed.ts", "changed")');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/cloudflare-build-verified.cjs')], { cwd: f.dir, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Build inputs changed while building/);
  } finally { f.cleanup(); }
});

test('official config uses the verified build hook and deployment does not build twice', () => {
  const config = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
  assert.match(config, /"build"\s*:\s*\{\s*"command"\s*:\s*"node scripts\/cloudflare-build-verified\.cjs"\s*\}/);
  assert.match(config, /"main"\s*:\s*"\.open-next\/worker\.js"/);
  assert.equal(require('../package.json').scripts['deploy:cloudflare'], 'node scripts/cloudflare-deploy.cjs');
});

test('npm deploy command invokes the local Wrangler entry with a portable environment and propagates failure', () => {
  const f = fixture();
  try {
    f.write('package.json', JSON.stringify({ private: true, scripts: { 'deploy:cloudflare': require('../package.json').scripts['deploy:cloudflare'] } }));
    f.write('scripts/cloudflare-deploy.cjs', fs.readFileSync(path.join(root, 'scripts/cloudflare-deploy.cjs')));
    f.write('node_modules/wrangler/bin/wrangler.js', `
      const fs = require('node:fs');
      fs.writeFileSync('wrangler-call.json', JSON.stringify({ args: process.argv.slice(2), openNext: process.env.OPEN_NEXT_DEPLOY }));
      process.exit(Number(process.env.FAKE_WRANGLER_EXIT || 0));
    `);
    for (const code of [0, 19]) {
      // Only the fake executable above is reachable; no Cloudflare action occurs.
      const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'deploy:cloudflare', '--', '--example-flag'], {
        cwd: f.dir, env: { ...process.env, FAKE_WRANGLER_EXIT: String(code) },
        shell: process.platform === 'win32', encoding: 'utf8', timeout: 20000,
      });
      assert.equal(result.status, code, result.stdout + result.stderr);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, 'wrangler-call.json'), 'utf8')), {
        args: ['deploy', '--example-flag'], openNext: 'true',
      });
    }
  } finally { f.cleanup(); }
});

test('npm wrapper stops on build or artifact verification failure without reaching simulated upload', () => {
  const f = fixture();
  try {
    f.write('package.json', JSON.stringify({ private: true, scripts: { 'deploy:cloudflare': require('../package.json').scripts['deploy:cloudflare'] } }));
    for (const script of ['cloudflare-deploy.cjs', 'cloudflare-build-verified.cjs']) {
      f.write(`scripts/${script}`, fs.readFileSync(path.join(root, 'scripts', script)));
    }
    // This is a fake Wrangler: its only "upload" is a local marker file.
    f.write('node_modules/wrangler/bin/wrangler.js', `
      const { spawnSync } = require('node:child_process');
      const result = spawnSync(process.execPath, ['scripts/cloudflare-build-verified.cjs'], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
      require('node:fs').writeFileSync('simulated-upload', 'unexpected');
    `);
    f.write('node_modules/@opennextjs/cloudflare/dist/cli/index.js', `
      if (process.env.FAIL_MODE === 'build') process.exit(7);
      const fs = require('node:fs');
      fs.mkdirSync('.next', { recursive: true });
      fs.writeFileSync('.next/BUILD_ID', 'build123');
      // Report build success without producing the required OpenNext artifact.
    `);
    for (const mode of ['build', 'verify']) {
      f.write('.open-next/worker.js', 'old artifact');
      const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'deploy:cloudflare'], {
        cwd: f.dir, env: { ...process.env, FAIL_MODE: mode },
        shell: process.platform === 'win32', encoding: 'utf8', timeout: 20000,
      });
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stderr, mode === 'build' ? /OpenNext build failed/ : /Cloudflare build verification failed/);
      assert.equal(fs.existsSync(path.join(f.dir, '.open-next/worker.js')), false);
      assert.equal(fs.existsSync(path.join(f.dir, 'simulated-upload')), false);
    }
  } finally { f.cleanup(); }
});

test('installed Wrangler executes a failing custom build before starting dev, including with no-bundle', () => {
  const f = fixture();
  try {
    f.write('wrangler.jsonc', JSON.stringify({ name: 'aura-fixture', main: 'missing.js', compatibility_date: '2025-04-01', build: { command: 'node hook.cjs' } }));
    f.write('hook.cjs', 'require("fs").writeFileSync("hook-ran", process.env.WRANGLER_COMMAND); process.exit(9)');
    const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
    for (const extra of [[], ['--no-bundle']]) {
      fs.rmSync(path.join(f.dir, 'hook-ran'), { force: true });
      const result = spawnSync(process.execPath, [cli, 'dev', '--local', '--config', 'wrangler.jsonc', ...extra], { cwd: f.dir, env: { PATH: process.env.PATH, HOME: f.dir, CI: '1', WRANGLER_SEND_METRICS: 'false' }, encoding: 'utf8', timeout: 20000 });
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.equal(fs.readFileSync(path.join(f.dir, 'hook-ran'), 'utf8'), 'dev');
    }
  } finally { f.cleanup(); }
});
