"""HTTP regression checks for a disposable .arena/integration-app instance only.
The instance must use SQLite, mocked customer/admin identities, and the claim
safety gate removed in that test copy. Never point this test at a real server.
The database path guard below refuses the actual workspace data directory.
"""
import json,urllib.request,urllib.error,uuid,sqlite3,pathlib
from concurrent.futures import ThreadPoolExecutor
B='http://127.0.0.1:3457'; D=pathlib.Path('data/aura.db').resolve()
assert '.arena/integration-app/data/' in str(D), 'Refusing non-test database'
def req(path,method='GET',body=None,user=None,guest=None):
 h={'Origin':B}
 if user:h['x-test-account']=user
 if guest:h['x-aura-guest-token']=guest
 if body is not None:h['Content-Type']='application/json'
 try:
  with urllib.request.urlopen(urllib.request.Request(B+path,headers=h,method=method,data=json.dumps(body).encode() if body is not None else None),timeout=60) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  try:return e.code,json.load(e)
  except Exception:return e.code,{}
def db():
 c=sqlite3.connect(D,timeout=15);c.execute('PRAGMA foreign_keys=ON');return c
def cart():
 guest=uuid.uuid4().hex;code,b=req('/api/store/cart','POST',{'productId':pid},guest=guest);assert code==200,(code,b);return guest
def submit(guest,phone,user=None,extra=None):
 payload={'customerName':'Test Buyer','customerPhone':phone,'governorate':'Baghdad','city':'Baghdad','address':'Test address 1','paymentMethod':'الدفع عند الاستلام'}
 if extra:payload.update(extra)
 return req('/api/store/checkout','POST',payload,user,guest)
def status(id,s):
 code,b=req('/api/admin/orders/'+str(id),'PATCH',{'status':s});assert code==200,(code,b)
def claim(user,key):return req('/api/store/customer/rewards/claim','POST',{'requestKey':key},user)
def progress(user):
 code,b=req('/api/store/customer/me',user=user);assert code==200,(code,b);return b['rewards']['completed']
assert req('/api/store/cart')[0]==200
with db() as c:
 c.executescript(pathlib.Path('src/db/migrations/0002_customer_rewards.sqlite.sql').read_text());c.execute('UPDATE aura_reward_settings SET enabled=1');c.execute('UPDATE promotions SET is_active=0')
 c.execute("INSERT INTO products(sku,slug,name,gender_id,price_iqd,stock_quantity,status) VALUES('test-product','test-product','test',1,15000,100,'active')");pid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
 # Insert a historical order whose number conflicts with the next order identity.
 nextid=c.execute('SELECT MAX(id)+2 FROM orders').fetchone()[0]
 collision=f'AURA-2026-{1000+nextid}'
 c.execute("INSERT INTO orders(order_number,customer_name,customer_phone,governorate,city,address) VALUES(?, 'Test','07700000000','Test','Test','Test')",(collision,))
code,b=submit(cart(),'07700000001');assert code==200,(code,b)
assert b['order']['orderId']==nextid and b['order']['orderNumber']!=collision,(collision,b)
print('PASS forced historical order_number collision retried in real checkout')
g1,g2=cart(),cart()
with ThreadPoolExecutor(max_workers=2) as ex:
 results=list(ex.map(lambda args:submit(*args),[(g1,'07700000002'),(g2,'07700000003','u1')]))
assert all(code==200 for code,_ in results),results
assert results[0][1]['order']['orderNumber']!=results[1][1]['order']['orderNumber']
with db() as c:
 assert c.execute('SELECT COUNT(*)=COUNT(DISTINCT order_number) FROM orders').fetchone()[0]==1
 assert c.execute('SELECT COUNT(*) FROM customer_account_orders WHERE order_id=?',(results[1][1]['order']['orderId'],)).fetchone()[0]==1
print('PASS two concurrent HTTP checkouts, one guest and one authenticated, unique order numbers')
orders=[results[1][1]['order']['orderId']];status(orders[0],'delivered')
for i in range(4):
 code,b=submit(cart(),f'0770000001{i}','u1');assert code==200,(code,b);oid=b['order']['orderId'];orders.append(oid);status(oid,'delivered');assert progress('u1')==i+2
key=str(uuid.uuid4())
with ThreadPoolExecutor(max_workers=2) as ex:results=list(ex.map(lambda _:claim('u1',key),range(2)))
assert sorted(code for code,_ in results)==[200,201],results
assert results[0][1]['grant']['id']==results[1][1]['grant']['id'];gid=results[0][1]['grant']['id']
assert claim('u1',str(uuid.uuid4()))[0]==409
print('PASS HTTP 5/5 and same request key concurrently: one grant and one retry')
code,b=submit(cart(),'07700000020','u1',{'rewardGrantId':gid,'creditIqd':999999});assert code==200,(code,b);assert b['order']['creditUsedIqd']==5000;oid=b['order']['orderId']
assert submit(cart(),'07700000021','u1',{'rewardGrantId':gid})[0]==409
def cancel():
 status(oid,'cancelled')
def returned():
 code,b=req('/api/admin/orders/'+str(oid)+'/reward-return','POST');assert code==200,(code,b)
with ThreadPoolExecutor(max_workers=2) as ex:
 list(ex.map(lambda fn: fn(), (cancel, returned)))
cancel(); returned()
with db() as c:
 assert c.execute('SELECT remaining_iqd,status FROM aura_reward_grants WHERE id=?',(gid,)).fetchone()==(5000,'available')
 uses=c.execute('SELECT id,amount_iqd FROM aura_reward_credit_uses WHERE order_id=?',(oid,)).fetchall();assert len(uses)==1 and uses[0][1]==5000
 incidents=c.execute('SELECT reason FROM aura_reward_credit_review_incidents WHERE credit_use_id=? ORDER BY reason',(uses[0][0],)).fetchall();assert incidents==[('cancelled',),('returned',)],incidents
 assert c.execute('SELECT amount_iqd FROM aura_reward_credit_restorations WHERE credit_use_id=?',(uses[0][0],)).fetchall()==[(5000,)]
print('PASS HTTP credit use and exactly-once restoration after cancellation/return; no monetary refund')
for cycle,grant_status,expiry in [(10,'revoked',None),(11,'used','2000-01-01')]:
 code,b=submit(cart(),f'077000000{cycle+20}','u1');assert code==200,(code,b);invalid_oid=b['order']['orderId']
 with db() as c:
  c.execute("INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd,status,expires_at) VALUES('u1',1,?,?,'رصيد','credit',5000,3000,?,?)",(cycle,f'blocked-{cycle}',grant_status,expiry))
  invalid_gid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
  c.execute('INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES(?,?,2000)',(invalid_gid,invalid_oid))
 status(invalid_oid,'cancelled')
 with db() as c:
  assert c.execute('SELECT remaining_iqd FROM aura_reward_grants WHERE id=?',(invalid_gid,)).fetchone()==(3000,)
  assert c.execute('SELECT count(*) FROM aura_reward_credit_restorations r JOIN aura_reward_credit_uses u ON u.id=r.credit_use_id WHERE u.order_id=?',(invalid_oid,)).fetchone()==(0,)
  assert c.execute('SELECT count(*) FROM aura_reward_credit_review_incidents r JOIN aura_reward_credit_uses u ON u.id=r.credit_use_id WHERE u.order_id=?',(invalid_oid,)).fetchone()==(1,)
print('PASS HTTP revoked and expired grant credit stays for review')
with db() as c:
 c.execute("UPDATE aura_reward_definitions SET active=CASE WHEN kind='necklace' THEN 1 ELSE 0 END")
 c.execute("UPDATE aura_reward_definitions SET stock_quantity=1 WHERE kind='necklace'")
for u in ('u2','u3'):
 for i in range(5):
  phone='07700000'+('2' if u=='u2' else '3')+f'{i:02d}'
  code,b=submit(cart(),phone,u);assert code==200,(code,b);status(b['order']['orderId'],'delivered')
with ThreadPoolExecutor(max_workers=2) as ex:results=list(ex.map(lambda user:claim(user,str(uuid.uuid4())),('u2','u3')))
assert sorted(code for code,_ in results)==[201,409],results
with db() as c:
 assert c.execute("SELECT stock_quantity FROM aura_reward_definitions WHERE kind='necklace'").fetchone()[0]==0
 assert c.execute("SELECT count(*) FROM aura_reward_grants WHERE kind='necklace'").fetchone()[0]==1
print('PASS concurrent HTTP claims for last physical item (SQLite)')
