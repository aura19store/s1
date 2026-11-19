const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Contract check only: Hyperdrive documents CURRENT_TIMESTAMP as an uncacheable
// STABLE expression. These assertions do not replace a live Cloudflare test.
const cases = [
  ['src/lib/auth.ts', /WHERE s\.token_hash = \? AND CURRENT_TIMESTAMP IS NOT NULL/],
  ['src/app/api/admin/products/route.ts', /const where: string\[\] = \["CURRENT_TIMESTAMP IS NOT NULL"\]/],
  ['src/app/api/admin/products/[id]/route.ts', /SELECT \* FROM products WHERE id = \? AND CURRENT_TIMESTAMP IS NOT NULL/],
  ['src/app/api/admin/orders/route.ts', /const where: string\[\] = \["CURRENT_TIMESTAMP IS NOT NULL"\]/],
  ['src/app/api/admin/orders/[id]/route.ts', /SELECT \* FROM orders WHERE id = \? AND CURRENT_TIMESTAMP IS NOT NULL/],
  ['src/app/api/admin/orders/[id]/route.ts', /SELECT \* FROM order_items WHERE order_id = \? AND CURRENT_TIMESTAMP IS NOT NULL/],
  ['src/app/api/admin/filters/route.ts', /SELECT \* FROM attributes WHERE CURRENT_TIMESTAMP IS NOT NULL/],
  ['src/app/api/admin/filters/route.ts', /FROM attribute_values av\s+WHERE CURRENT_TIMESTAMP IS NOT NULL/],
  ['src/app/api/admin/users/route.ts', /JOIN roles r ON r\.id = u\.role_id\s+WHERE CURRENT_TIMESTAMP IS NOT NULL/],
];
for (const [file, expression] of cases) {
  test(`fresh admin read contract: ${file} ${expression.source}`, () => {
    assert.match(fs.readFileSync(file, 'utf8'), expression);
  });
}
