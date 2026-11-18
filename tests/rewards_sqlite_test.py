"""Isolated SQLite migration/constraint/concurrency checks; does not touch the app database."""
import pathlib, sqlite3, tempfile, threading, unittest

MIGRATION = pathlib.Path('src/db/migrations/0002_customer_rewards.sqlite.sql').read_text()

class RewardsDatabaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / 'test.db'
        self.db = self.connect()
        self.db.execute('CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT, subtotal_iqd INTEGER)')
        self.db.executescript(MIGRATION)
        self.db.executescript(MIGRATION)
        self.db.execute("INSERT INTO customer_accounts(auth_user_id,email) VALUES ('u1','a@example.test'),('u2','b@example.test')")
        self.db.commit()

    def tearDown(self):
        self.db.close(); self.tmp.cleanup()

    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.execute('PRAGMA foreign_keys=ON')
        return db

    def test_defaults_and_duplicate_association(self):
        self.assertEqual(self.db.execute('SELECT enabled, qualifying_subtotal_iqd, required_orders FROM aura_reward_settings').fetchone(), (0,15000,5))
        self.assertEqual(self.db.execute('SELECT kind FROM aura_reward_definitions ORDER BY sequence_position').fetchall(), [(x,) for x in ('credit','credit','necklace','bracelet','watch','wallet','bag')])
        self.db.execute("INSERT INTO orders VALUES(1,'delivered',15000)")
        self.db.execute("INSERT INTO customer_account_orders(order_id,auth_user_id) VALUES(1,'u1')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO customer_account_orders(order_id,auth_user_id) VALUES(1,'u2')")

    def test_credit_debit_and_expiry(self):
        self.db.execute("INSERT INTO orders VALUES(1,'pending',1000),(2,'pending',1000),(3,'pending',1000)")
        self.db.execute("INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd) VALUES('u1',1,0,'key1','credit','credit',5000,5000)")
        self.db.execute("UPDATE aura_reward_grants SET remaining_iqd=remaining_iqd-1000 WHERE id=1 AND status='available' AND remaining_iqd>=1000")
        self.db.execute("INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES(1,1,1000)")
        self.assertEqual(self.db.execute('SELECT remaining_iqd FROM aura_reward_grants').fetchone()[0],4000)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES(1,1,1000)')
        self.db.execute("UPDATE aura_reward_grants SET expires_at='2000-01-01' WHERE id=1")
        self.assertEqual(self.db.execute("UPDATE aura_reward_grants SET remaining_iqd=0 WHERE id=1 AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").rowcount,0)

    def test_grant_uniqueness_revocation_and_return(self):
        self.db.execute("INSERT INTO orders VALUES (1,'delivered',15000)")
        self.db.execute("INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd) VALUES('u1',1,0,'same','credit','credit',5000,5000)")
        self.db.execute("INSERT INTO aura_reward_grant_orders(order_id,grant_id) VALUES(1,1)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd) VALUES('u1',1,0,'other','credit','credit',5000,5000)")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO aura_reward_grant_orders(order_id,grant_id) VALUES(1,1)")
        self.db.execute("INSERT INTO aura_reward_order_exclusions(order_id,reason) VALUES(1,'returned')")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM orders o LEFT JOIN aura_reward_order_exclusions e ON e.order_id=o.id WHERE o.status='delivered' AND o.subtotal_iqd>=15000 AND e.order_id IS NULL").fetchone()[0],0)
        result=self.db.execute("UPDATE aura_reward_grants SET status='revoked', revoked_at=datetime('now') WHERE id=1 AND status IN ('available','expired') AND (kind<>'credit' OR remaining_iqd=credit_iqd)")
        self.assertEqual(result.rowcount,1)
        self.assertEqual(self.db.execute("UPDATE aura_reward_grants SET remaining_iqd=0 WHERE id=1 AND status='available'").rowcount,0)

    def test_large_credit_remaining_and_used(self):
        self.db.execute("INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd) VALUES('u1',2,0,'key','credit','credit',25000,25000)")
        query="UPDATE aura_reward_grants SET remaining_iqd=remaining_iqd-?, status=CASE WHEN remaining_iqd=? THEN 'used' ELSE 'available' END, used_at=datetime('now') WHERE id=? AND auth_user_id=? AND status='available' AND remaining_iqd>=? AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))"
        self.assertEqual(self.db.execute(query,(5000,5000,1,'u1',5000)).rowcount,1)
        self.assertEqual(self.db.execute('SELECT remaining_iqd,status FROM aura_reward_grants').fetchone(),(20000,'available'))
        self.assertEqual(self.db.execute(query,(20000,20000,1,'u1',20000)).rowcount,1)
        self.assertEqual(self.db.execute(query,(1,1,1,'u1',1)).rowcount,0)

    def test_credit_review_is_idempotent_and_does_not_refund(self):
        self.db.execute("INSERT INTO orders VALUES (1,'cancelled',15000)")
        self.db.execute("INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd) VALUES('u1',1,0,'r','credit','credit',5000,3000)")
        self.db.execute("INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES(1,1,2000)")
        for _ in range(2):
            self.db.execute("INSERT OR IGNORE INTO aura_reward_credit_review_incidents(credit_use_id,reason) VALUES(1,'cancelled')")
        self.db.execute("INSERT OR IGNORE INTO aura_reward_credit_review_incidents(credit_use_id,reason) VALUES(1,'returned')")
        self.assertEqual(self.db.execute('SELECT reason FROM aura_reward_credit_review_incidents ORDER BY id').fetchall(), [('cancelled',), ('returned',)])
        self.assertEqual(self.db.execute('SELECT remaining_iqd FROM aura_reward_grants').fetchone(), (3000,))
        self.assertEqual(self.db.execute('SELECT amount_iqd FROM aura_reward_credit_uses').fetchone(), (2000,))

    def test_concurrent_last_piece(self):
        self.db.execute("UPDATE aura_reward_definitions SET stock_quantity=1 WHERE kind='necklace'"); self.db.commit()
        barrier = threading.Barrier(2); results=[]
        def claim():
            db=self.connect(); barrier.wait()
            try:
                db.execute('BEGIN IMMEDIATE')
                n=db.execute("UPDATE aura_reward_definitions SET stock_quantity=stock_quantity-1 WHERE kind='necklace' AND stock_quantity>0").rowcount
                db.commit(); results.append(n)
            finally: db.close()
        threads=[threading.Thread(target=claim) for _ in range(2)]
        for thread in threads: thread.start()
        for thread in threads: thread.join()
        self.assertEqual(sorted(results),[0,1])
        self.assertEqual(self.db.execute("SELECT stock_quantity FROM aura_reward_definitions WHERE kind='necklace'").fetchone()[0],0)

if __name__ == '__main__': unittest.main()
