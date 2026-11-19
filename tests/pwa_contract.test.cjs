const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));

test('manifest describes standalone RTL app and all declared PNG dimensions are real', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.dir, 'rtl');
  assert(manifest.lang.startsWith('ar'));
  assert(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const png = read('public' + icon.src);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
  const apple = read('public/icons/aura-180.png');
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
  assert.equal(read('public/favicon.ico').subarray(0, 4).toString('hex'), '00000100');
});

test('manifest and Apple icon are in the actual static head, not streamed metadata', () => {
  const layout = read('src/app/layout.tsx').toString();
  const head = layout.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  assert(head && head.includes('rel="manifest"') && head.includes('/manifest.webmanifest'));
  assert(head.includes('rel="apple-touch-icon"') && head.includes('/icons/aura-180.png'));
  assert(head.includes('apple-mobile-web-app-capable'));
});

test('iOS startup images cover declared device sizes and both orientations with real PNG dimensions', () => {
  const devices = JSON.parse(read('src/lib/pwa-splash-devices.json'));
  const layout = read('src/app/layout.tsx').toString();
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.background_color.toLowerCase(), '#f7f4ef');
  assert(layout.includes('backgroundColor: "#F7F4EF"'));
  const head = layout.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  assert(head && head.includes('rel="apple-touch-startup-image"'));
  assert(head.includes('device-width: ${width}px') && head.includes('device-height: ${height}px'));
  assert(head.includes('-webkit-device-pixel-ratio: ${scale}') && head.includes('orientation: ${orientation}'));
  const keys = new Set();
  for (const { width, height, scale } of devices) {
    const key = `${width}x${height}@${scale}`;
    assert(!keys.has(key), `duplicate device ${key}`);
    keys.add(key);
    for (const orientation of ['portrait', 'landscape']) {
      const png = read(`public/splash/${key}-${orientation}.png`);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16), (orientation === 'portrait' ? width : height) * scale);
      assert.equal(png.readUInt32BE(20), (orientation === 'portrait' ? height : width) * scale);
    }
  }
  assert(keys.has('393x852@3') && keys.has('834x1194@2'));
});

test('service worker caches only offline shell and bypasses sensitive and non-navigation requests', async () => {
  const handlers = {};
  const added = [];
  const deleted = [];
  let offline = false;
  const offlineResponse = { offline: true };
  const context = {
    URL, Response,
    self: { location: { origin: 'https://shop.example' }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: {
      open: async () => ({ add: async url => added.push(url) }),
      keys: async () => ['aura-offline-old', 'other-app-cache', 'aura-offline-v1'],
      delete: async key => deleted.push(key),
      match: async url => url === '/offline.html' ? offlineResponse : undefined,
    },
    fetch: async () => { if (offline) throw Error('offline'); return { network: true }; },
  };
  vm.runInNewContext(read('public/sw.js').toString(), context);
  let task;
  handlers.install({ waitUntil: promise => { task = promise; } }); await task;
  assert.deepEqual(added, ['/offline.html']);
  handlers.activate({ waitUntil: promise => { task = promise; } }); await task;
  assert.deepEqual(deleted, ['aura-offline-old']);
  function dispatch(url, mode = 'navigate', method = 'GET') {
    let response;
    handlers.fetch({ request: { url: `https://shop.example${url}`, mode, method }, respondWith: promise => { response = promise; } });
    return response;
  }
  for (const [url, mode, method] of [
    ['/api/store/cart', 'navigate', 'GET'], ['/admin/orders', 'navigate', 'GET'],
    ['/store/men/cart', 'cors', 'GET'], ['/store/men/checkout', 'navigate', 'POST'],
  ]) assert.equal(dispatch(url, mode, method), undefined);
  assert.deepEqual(await dispatch('/store/men'), { network: true });
  offline = true;
  assert.equal(await dispatch('/store/men'), offlineResponse);
});
