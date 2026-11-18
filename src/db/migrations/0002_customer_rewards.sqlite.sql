-- SQLite additive migration, not automatically applied. Review and apply separately before enabling these features.
-- Existing guest customers, orders, admin users and sessions are not modified.
BEGIN;

CREATE TABLE IF NOT EXISTS customer_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auth_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_email_lower ON customer_accounts (LOWER(email));

-- Only new orders explicitly placed while authenticated may be linked here.
CREATE TABLE IF NOT EXISTS customer_account_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  auth_user_id TEXT NOT NULL REFERENCES customer_accounts(auth_user_id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_account_orders_user ON customer_account_orders(auth_user_id, order_id);

CREATE TABLE IF NOT EXISTS aura_reward_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  qualifying_subtotal_iqd INTEGER NOT NULL DEFAULT 15000 CHECK (qualifying_subtotal_iqd >= 0),
  required_orders INTEGER NOT NULL DEFAULT 5 CHECK (required_orders > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS aura_reward_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'necklace', 'bracelet', 'watch', 'wallet', 'bag')),
  credit_iqd INTEGER NOT NULL DEFAULT 0 CHECK (credit_iqd >= 0),
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  expiry_days INTEGER CHECK (expiry_days IS NULL OR expiry_days > 0),
  sequence_position INTEGER NOT NULL CHECK (sequence_position >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((kind = 'credit' AND credit_iqd > 0 AND stock_quantity IS NULL)
      OR (kind <> 'credit' AND credit_iqd = 0 AND stock_quantity IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS aura_reward_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auth_user_id TEXT NOT NULL REFERENCES customer_accounts(auth_user_id) ON DELETE RESTRICT,
  reward_id INTEGER NOT NULL REFERENCES aura_reward_definitions(id) ON DELETE RESTRICT,
  cycle_number INTEGER NOT NULL CHECK (cycle_number >= 0),
  request_key TEXT NOT NULL,
  reward_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'necklace', 'bracelet', 'watch', 'wallet', 'bag')),
  credit_iqd INTEGER NOT NULL DEFAULT 0 CHECK (credit_iqd >= 0),
  remaining_iqd INTEGER NOT NULL DEFAULT 0 CHECK (remaining_iqd >= 0 AND remaining_iqd <= credit_iqd),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'revoked', 'expired')),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  used_at TEXT,
  revoked_at TEXT,
  UNIQUE (auth_user_id, cycle_number),
  UNIQUE (auth_user_id, request_key),
  CHECK ((kind = 'credit' AND credit_iqd > 0) OR (kind <> 'credit' AND credit_iqd = 0 AND remaining_iqd = 0))
);
CREATE INDEX IF NOT EXISTS idx_aura_reward_grants_user ON aura_reward_grants(auth_user_id, granted_at);

-- Released associations stay in the audit trail but cannot consume another cycle concurrently.
CREATE TABLE IF NOT EXISTS aura_reward_grant_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  grant_id INTEGER NOT NULL REFERENCES aura_reward_grants(id) ON DELETE RESTRICT,
  released_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aura_reward_one_active_grant_per_order
  ON aura_reward_grant_orders(order_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aura_reward_grant_orders_grant ON aura_reward_grant_orders(grant_id);

-- Each order can debit a given reward only once; writes must occur with the order transaction.
CREATE TABLE IF NOT EXISTS aura_reward_credit_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_id INTEGER NOT NULL REFERENCES aura_reward_grants(id) ON DELETE RESTRICT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_iqd INTEGER NOT NULL CHECK (amount_iqd > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (grant_id, order_id)
);

-- A restoration is an audit record, not a monetary refund or a new grant.
CREATE TABLE IF NOT EXISTS aura_reward_credit_restorations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_use_id INTEGER NOT NULL UNIQUE REFERENCES aura_reward_credit_uses(id) ON DELETE RESTRICT,
  amount_iqd INTEGER NOT NULL CHECK (amount_iqd > 0),
  reason TEXT NOT NULL CHECK (reason IN ('cancelled', 'returned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every cancellation/return is recorded; a missing restoration means manual review.
CREATE TABLE IF NOT EXISTS aura_reward_credit_review_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_use_id INTEGER NOT NULL REFERENCES aura_reward_credit_uses(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (reason IN ('cancelled', 'returned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (credit_use_id, reason)
);
CREATE INDEX IF NOT EXISTS idx_aura_reward_credit_review_use ON aura_reward_credit_review_incidents(credit_use_id);

CREATE TABLE IF NOT EXISTS aura_reward_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  grant_id INTEGER NOT NULL REFERENCES aura_reward_grants(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, grant_id)
);

CREATE TABLE IF NOT EXISTS aura_reward_reset_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  auth_user_id TEXT NOT NULL REFERENCES customer_accounts(auth_user_id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exclude returned orders without changing the existing order status constraint.
CREATE TABLE IF NOT EXISTS aura_reward_order_exclusions (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (reason IN ('returned', 'manual')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Defaults are disabled, and physical stock starts at zero until configured by an administrator.
INSERT INTO aura_reward_settings (id, enabled, qualifying_subtotal_iqd, required_orders)
VALUES (1, 0, 15000, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO aura_reward_definitions (name, kind, credit_iqd, stock_quantity, sequence_position)
SELECT seed.name, seed.kind, seed.credit_iqd, seed.stock_quantity, seed.sequence_position
FROM (
  SELECT 'رصيد ٥٬٠٠٠ د.ع' AS name, 'credit' AS kind, 5000 AS credit_iqd, NULL AS stock_quantity, 0 AS sequence_position
  UNION ALL SELECT 'رصيد ٢٥٬٠٠٠ د.ع', 'credit', 25000, NULL, 1
  UNION ALL SELECT 'عقد', 'necklace', 0, 0, 2
  UNION ALL SELECT 'سوار', 'bracelet', 0, 0, 3
  UNION ALL SELECT 'ساعة', 'watch', 0, 0, 4
  UNION ALL SELECT 'محفظة', 'wallet', 0, 0, 5
  UNION ALL SELECT 'حقيبة', 'bag', 0, 0, 6
) seed WHERE NOT EXISTS (SELECT 1 FROM aura_reward_definitions);

-- SQLite is accessed only through the server, not a public Supabase API.

COMMIT;
