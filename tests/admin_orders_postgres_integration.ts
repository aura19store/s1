// Requires a freshly created disposable aura_preflight_test database in .arena/pg-data,
// with migrations 0001–0004 and an isolated app server on 127.0.0.1:35418.
// It refuses to operate against any other PostgreSQL data directory.
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';import {userInfo} from 'node:os';import {randomBytes,randomUUID,createHash} from 'node:crypto';import {Pool} from 'pg';
import {createOrderPdf} from '../src/lib/order-pdf';
const pool=new Pool({host:path.resolve('.arena/pg-socket'),port:55432,user:userInfo().username,database:'aura_preflight_test',max:10});
async function main(){
 const dir=await pool.query('show data_directory');assert.equal(dir.rows[0].data_directory,path.resolve('.arena/pg-data'));
 for(const table of ['media_deletion_jobs','order_status_operations']){
  const r=await pool.query("select relrowsecurity from pg_class where oid=to_regclass($1)",['public.'+table]);assert.equal(r.rows[0].relrowsecurity,true);
  const p=await pool.query("select permissive,cmd,qual,with_check,roles from pg_policies where schemaname='public' and tablename=$1 and policyname='aura_deny_browser_roles'",[table]);assert.equal(p.rowCount,1);assert.equal(p.rows[0].permissive,'RESTRICTIVE');assert.equal(p.rows[0].cmd,'ALL');assert.equal(p.rows[0].qual,'false');assert.equal(p.rows[0].with_check,'false');assert(p.rows[0].roles.includes('anon')&&p.rows[0].roles.includes('authenticated'));
  for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await pool.query("select has_table_privilege($1,$2,$3) ok",[role,'public.'+table,privilege])).rows[0].ok,false);
 }
 console.log('PASS isolated migrations 0003/0004 RLS, restrictive policy and per-privilege role checks (not production)');
 await pool.query("insert into roles(id,slug,name,permissions_json) values (1,'super_admin','مدير','[]'),(2,'restricted','محدود','[]')");
 await pool.query("insert into users(id,name,email,password_hash,role_id) values (1,'اختبار','admin@invalid.test','unused',1),(2,'محدود','limited@invalid.test','unused',2)");
 const token=()=>randomBytes(24).toString('hex');const admin=token(),low=token();for(const [id,t] of [[1,admin],[2,low]] as const) await pool.query("insert into admin_sessions(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 hour')",[id,createHash('sha256').update(t).digest('hex')]);
 const base='http://127.0.0.1:35418';async function req(id:number,method='DELETE',t=admin){const r=await fetch(`${base}/api/admin/orders/${id}`,{method,headers:{cookie:`aura_admin_session=${t}`}});return {status:r.status,data:await r.json()};}
 const customer=(await pool.query("insert into customers(name,phone,orders_count,total_spent_iqd) values('تجريبي','000',3,9000) returning id")).rows[0].id;
 async function order(number:string,status:string,amount:number){return (await pool.query("insert into orders(order_number,customer_id,customer_name,customer_phone,governorate,city,address,payment_method,status,subtotal_iqd,shipping_iqd,total_iqd) values($1,$2,'عميل تجريبي','000','بغداد','بغداد','عنوان تجريبي','الدفع عند الاستلام',$3,$4,0,$4) returning id",[number,customer,status,amount])).rows[0].id}
 const normal=await order('test-normal','cancelled',1000),active=await order('test-active','pending',3000),linked=await order('test-linked','cancelled',5000);
 await pool.query("insert into order_items(order_id,product_name,quantity,unit_price_iqd,total_price_iqd) values ($1,'منتج تجريبي',1,1000,1000),($2,'منتج تجريبي',1,5000,5000)",[normal,linked]);
 await pool.query("insert into aura_reward_order_exclusions(order_id,reason) values($1,'returned')",[linked]);
 assert.equal((await req(normal,'DELETE',low)).status,403);assert.equal((await req(active)).status,409);assert.equal((await req(linked)).status,409, "a PostgreSQL RESTRICT violation must be reported as conflict, not a server failure");
 let retained=await pool.query('select (select count(*) from orders where id=$1)::int orders,(select count(*) from order_items where order_id=$1)::int items,(select count(*) from aura_reward_order_exclusions where order_id=$1)::int rewards',[linked]);assert.deepEqual(retained.rows[0],{orders:1,items:1,rewards:1});
 const pair=await Promise.all([req(normal),req(normal)]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,404]);assert.equal((await req(normal)).status,404);
 const rows=await pool.query("select (select count(*) from orders where id=$1)::int orders,(select count(*) from order_items where order_id=$1)::int items,orders_count,total_spent_iqd from customers where id=$2",[normal,customer]);assert.deepEqual(rows.rows[0],{orders:0,items:0,orders_count:2,total_spent_iqd:8000});
 console.log('PASS actual PostgreSQL HTTP route: permissions, active rejection, rewards rollback, concurrent/repeated delete, cascades and customer totals');
 // The status request's first read can see a row that a concurrent deletion has
 // removed but not committed. Wait until PATCH blocks on FOR UPDATE, then commit.
 const raceId=await order('test-delete-status-race','cancelled',0);
 const locker=await pool.connect();
 try {
  await locker.query('BEGIN');await locker.query('DELETE FROM orders WHERE id=$1',[raceId]);
  const patch=fetch(`${base}/api/admin/orders/${raceId}`,{method:'PATCH',headers:{cookie:`aura_admin_session=${admin}`,'content-type':'application/json'},body:JSON.stringify({status:'pending',expected_status:'cancelled',operation_id:randomUUID()})});
  let waiting=false;
  for(let i=0;i<100;i++){const q=await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT status FROM orders WHERE id = %FOR UPDATE%') AS waiting");if(q.rows[0].waiting){waiting=true;break}await new Promise(resolve=>setTimeout(resolve,50));}
  assert(waiting,'status request did not wait for the deletion lock');await locker.query('COMMIT');assert.equal((await patch).status,404);
 } finally {await locker.query('ROLLBACK').catch(()=>{});locker.release();}
 console.log('PASS status update racing with committed deletion returns 404');
 const pdfOrder=await order('test-pdf','pending',74000);
 for(let i=0;i<60;i++) await pool.query("insert into order_items(order_id,product_name,variant_label,quantity,unit_price_iqd,total_price_iqd) values($1,$2,'ذهبي',1,1000,1000)",[pdfOrder,'منتج تجريبي '+i]);
 const result=await req(pdfOrder,'GET');assert.equal(result.status,200);assert.equal(result.data.items.length,60);
 const doc=await createOrderPdf(result.data.order,result.data.items,new Uint8Array(readFileSync('public/fonts/IBMPlexSansArabic-Regular.ttf')));assert(doc.getNumberOfPages()>=3);for(let i=1;i<=doc.getNumberOfPages();i++)assert((doc as any).internal.pages[i].join('\n').includes('0.94 0.92 0.89 rg'));const bytes=Buffer.from(doc.output('arraybuffer'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');writeFileSync('.arena/pdf-pg-preflight.pdf',bytes);
 console.log(`PASS PDF generated using isolated PostgreSQL HTTP response, ${doc.getNumberOfPages()} pages with repeated header`);
}
main().catch(e=>{console.error('FAIL isolated test:',e.message);process.exitCode=1}).finally(()=>pool.end());
