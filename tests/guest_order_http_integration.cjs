// Run only against a disposable SQLite store and its isolated local server.
// Example: AURA_DISPOSABLE_TEST_DATABASE=yes AURA_TEST_URL=http://127.0.0.1:35449 node tests/guest_order_http_integration.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const url = new URL(process.env.AURA_TEST_URL || 'http://127.0.0.1:35449');
if (process.env.AURA_DISPOSABLE_TEST_DATABASE !== 'yes' || url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw Error('A disposable local test server is required');
const db = new DatabaseSync('data/aura.db');
db.exec('PRAGMA foreign_keys=ON');
const random = () => crypto.randomBytes(32).toString('hex');
async function request(path, options = {}) { return fetch(new URL(path, url), options); }
async function main() {
  const productionCookie = await new Promise((resolve, reject) => {
    require('node:http').get(new URL('/api/store/orders/session', url), { headers: { host: 'shop.example' } }, response => { response.resume(); resolve(response.headers['set-cookie']?.[0] || ''); }).on('error', reject);
  });
  assert.match(productionCookie, /^__Host-aura_order_browser=[a-f0-9]{64};.*Secure/);
  const before = Number(db.prepare('SELECT count(*) n FROM orders').get().n);
  const product = db.prepare("SELECT id FROM products WHERE status='active' AND stock_quantity>=3 LIMIT 1").get();
  assert(product);
  const browsers = [], guests = [];
  for (let i = 0; i < 3; i++) {
    const guest = random(); guests.push(guest);
    const cart = Number(db.prepare('INSERT INTO carts(session_token) VALUES(?)').run(guest).lastInsertRowid);
    db.prepare('INSERT INTO cart_items(cart_id,product_id,quantity) VALUES(?,?,1)').run(cart, product.id);
    const session = await request('/api/store/orders/session');
    assert.equal(session.status, 200);
    browsers.push(session.headers.get('set-cookie').split(';')[0]);
  }
  const orders = await Promise.all(guests.map(async (guest, i) => {
    const response = await request('/api/store/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aura-guest-token': guest, cookie: browsers[i] }, body: JSON.stringify({ customerName: 'زبون اختبار محلي', customerPhone: `07701234${String(i).padStart(3,'0')}`, governorate: 'بغداد', city: 'المنصور', address: 'عنوان اختبار محلي', paymentMethod: 'الدفع عند الاستلام' }) });
    assert.equal(response.status, 200);
    return (await response.json()).order;
  }));
  assert.equal(new Set(orders.map(order => order.orderNumber)).size, 3);
  assert.equal(new Set(orders.map(order => order.trackingSecret)).size, 3);
  for (const order of orders) assert.match(order.trackingSecret, /^[a-f0-9]{64}$/);
  const get = (order, cookie = '') => request('/api/store/orders/' + encodeURIComponent(order.orderNumber), { headers: { cookie } });
  for (let i = 0; i < 3; i++) {
    const list = await (await request('/api/store/orders', { headers: { cookie: browsers[i] } })).json();
    assert.deepEqual(list.orders.map(o => o.order_number), [orders[i].orderNumber]);
    assert(!JSON.stringify(list).includes(orders[i].trackingSecret));
    for (let j = 0; j < 3; j++) {
      const result = await get(orders[j], browsers[i]);
      assert.equal(result.status, i === j ? 200 : 404);
      assert(!(await result.text()).includes(orders[j].trackingSecret));
    }
  }
  assert.equal((await get(orders[0])).status, 404);
  assert.equal((await request('/api/store/orders/track', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.invalid' }, body: '{}' })).status, 403);
  const track = (number, secret) => request('/api/store/orders/track', { method: 'POST', headers: { 'content-type': 'application/json', origin: url.origin }, body: JSON.stringify({ orderNumber: number, secret }) });
  const historical = db.prepare('SELECT o.order_number, o.customer_name FROM orders o LEFT JOIN guest_order_credentials c ON c.order_id=o.id WHERE c.order_id IS NULL LIMIT 1').get();
  assert(historical, 'A pre-existing order without tracking credentials is required');
  assert.equal((await get({orderNumber: historical.order_number})).status, 404);
  assert.equal((await get({orderNumber: historical.order_number}, browsers[0])).status, 404);
  assert.equal((await track(historical.order_number, orders[0].trackingSecret)).status, 404);
  const confirmation = await request('/store/men/order-confirmation/' + encodeURIComponent(historical.order_number));
  assert(!(await confirmation.text()).includes(historical.customer_name));
  assert.equal((await track(orders[0].orderNumber, '0'.repeat(64))).status, 404);
  assert.equal((await track(orders[1].orderNumber, orders[0].trackingSecret)).status, 404);
  const crossDevice = await track(orders[0].orderNumber, orders[0].trackingSecret);
  assert.equal(crossDevice.status, 200);
  const otherBrowser = crossDevice.headers.get('set-cookie').split(';')[0];
  assert.equal((await get(orders[0], otherBrowser)).status, 200);
  assert.equal((await get(orders[1], otherBrowser)).status, 404);
  assert.equal((await request(`/api/admin/orders/${orders[0].orderId}`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: url.origin }, body: JSON.stringify({ status: 'cancelled' }) })).status, 401);
  assert.equal((await request(`/api/admin/orders/${orders[0].orderId}`, { method: 'DELETE', headers: { origin: url.origin } })).status, 401);
  const admin = Number(db.prepare('INSERT INTO users(name,email,password_hash,role_id,is_active) VALUES(?,?,?,?,1)').run('اختبار', random() + '@example.invalid', 'disabled', 1).lastInsertRowid);
  const adminToken = random();
  db.prepare('INSERT INTO admin_sessions(user_id,token_hash,expires_at) VALUES(?,?,?)').run(admin, crypto.createHash('sha256').update(adminToken).digest('hex'), new Date(Date.now() + 3600000).toISOString());
  const adminHeaders = { cookie: 'aura_admin_session=' + adminToken, origin: url.origin, 'content-type': 'application/json' };
  let response = await request(`/api/admin/orders/${orders[0].orderId}`, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status: 'cancelled', expected_status: 'pending', operation_id: crypto.randomUUID() }) });
  assert.equal(response.status, 200);
  assert.equal((await (await get(orders[0], otherBrowser)).json()).order.status, 'cancelled');
  response = await request(`/api/admin/orders/${orders[0].orderId}`, { method: 'DELETE', headers: adminHeaders });
  assert.equal(response.status, 200);
  assert.equal((await get(orders[0], otherBrowser)).status, 404);
  assert.equal((await track(orders[0].orderNumber, orders[0].trackingSecret)).status, 404);
  assert.equal(db.prepare('SELECT count(*) n FROM guest_order_access WHERE order_id=?').get(orders[0].orderId).n, 0);
  assert.equal(Number(db.prepare('SELECT count(*) n FROM orders').get().n), before + 2);
  assert(db.prepare('SELECT 1 FROM orders WHERE order_number=?').get(historical.order_number));
  console.log('PASS three concurrent customers, order isolation, cross-device tracking, legacy denial, status, deletion and historical retention');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.close());
