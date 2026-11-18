import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { translateSqlForPostgres, type DbClient, type DbParam } from '../src/db';
import { recordCreditReview } from '../src/lib/reward-credit-review';
import { insertOrderWithUniqueNumber } from '../src/lib/order-number';

const root=process.cwd();
const pool=new Pool({host:path.join(root,'.arena/pg-socket'), port:55432, database:'postgres', user:userInfo().username, max:10});
function adapter(c: PoolClient): DbClient {
  return {
    async queryOne<T>(sql:string,...p:DbParam[]) { const r=await c.query(translateSqlForPostgres(sql),p); return (r.rows[0] ?? null) as T | null; },
    async queryAll<T>(sql:string,...p:DbParam[]) { const r=await c.query(translateSqlForPostgres(sql),p); return r.rows as T[]; },
    async execute(sql:string,...p:DbParam[]) { const r=await c.query(translateSqlForPostgres(sql,{appendReturningId:true}),p); return {changes:r.rowCount ?? 0,lastInsertRowid:Number(r.rows[0]?.id ?? 0)}; }
  };
}
async function transaction<T>(fn:(c:PoolClient,tx:DbClient)=>Promise<T>):Promise<T> {
 const c=await pool.connect(); try { await c.query('BEGIN'); const out=await fn(c,adapter(c)); await c.query('COMMIT'); return out; } catch(e) { await c.query('ROLLBACK'); throw e; } finally {c.release();}
}
async function main() {
 const where=await pool.query('SHOW data_directory');
 assert.equal(where.rows[0].data_directory,path.join(root,'.arena/pg-data'));
 await pool.query('CREATE ROLE anon; CREATE ROLE authenticated');
 await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated');
 await pool.query(readFileSync('supabase/migrations/0001_initial_schema.sql','utf8'));
 const migration=readFileSync('supabase/migrations/0002_customer_rewards.sql','utf8');
 await pool.query(migration); await pool.query(migration);
 console.log('PASS PostgreSQL 18: original 0001, 0002 and repeated 0002');
 const names=['customer_accounts','customer_account_orders','aura_reward_settings','aura_reward_definitions','aura_reward_grants','aura_reward_grant_orders','aura_reward_credit_uses','aura_reward_credit_restorations','aura_reward_credit_review_incidents','aura_reward_incidents','aura_reward_reset_orders','aura_reward_order_exclusions'];
 const rels=await pool.query(`SELECT relname,relrowsecurity FROM pg_class WHERE relkind='r' AND relname=ANY($1::text[])`,[names]);assert.equal(rels.rowCount,12);
 assert(rels.rows.every(r=>r.relrowsecurity===false));
 for(const name of names) for(const role of ['anon','authenticated']) {
  const r=await pool.query(`SELECT has_table_privilege($1::text,format('public.%I',$2::text),'SELECT,INSERT,UPDATE,DELETE') AS allowed`,[role,name]);assert.equal(r.rows[0].allowed,false);
  if(name!=='aura_reward_order_exclusions') { const sq=await pool.query(`SELECT pg_get_serial_sequence(format('public.%I',$1::text),'id') seq`,[name]); if(sq.rows[0].seq) { const p=await pool.query(`SELECT has_sequence_privilege($1::text,$2::text,'USAGE,SELECT,UPDATE') allowed`,[role,sq.rows[0].seq]);assert.equal(p.rows[0].allowed,false); } }
 }
 const fk=await pool.query(`SELECT count(*)::int c FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text = ANY($1::text[])`,[names]);assert.equal(fk.rows[0].c,15);
 const indexes=await pool.query(`SELECT indexname,indexdef FROM pg_indexes WHERE tablename = ANY($1::text[])`,[names]);assert(indexes.rows.some(r=>r.indexname==='idx_aura_reward_one_active_grant_per_order' && r.indexdef.includes('UNIQUE') && r.indexdef.includes('WHERE')));
 console.log('PASS 12 tables, 15 FKs, indexes, public-role table and sequence grants; RLS remains disabled');
 await pool.query(`INSERT INTO orders (id,order_number,customer_name,customer_phone,governorate,city,address) VALUES (100,'AURA-2026-1001','Test','07000000000','Test','Test','Test')`);
 const insert=()=>transaction(async (_c,tx)=>insertOrderWithUniqueNumber(tx,'postgres',async (id,num)=>(await tx.execute(`INSERT INTO orders(id,order_number,customer_name,customer_phone,governorate,city,address) VALUES(?,?,'Test','07000000000','Test','Test','Test') ON CONFLICT (order_number) DO NOTHING`,id,num)).changes));
 const numbers=await Promise.all([insert(),insert()]);assert.notEqual(numbers[0].orderNumber,numbers[1].orderNumber);assert(numbers.every(n=>n.orderNumber!=='AURA-2026-1001'));
 console.log('PASS real PostgreSQL: two concurrent connections, historical collision and distinct order numbers');
 await pool.query(`INSERT INTO customer_accounts(auth_user_id,email) VALUES('u1','test@example.test');
 INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd) VALUES('u1',1,0,'r','credit','credit',5000,3000);
 INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES(1,100,2000);`);
 await Promise.all([transaction((_c,tx)=>recordCreditReview(tx,100,'cancelled','postgres')),transaction((_c,tx)=>recordCreditReview(tx,100,'returned','postgres'))]);
 let result=await pool.query(`SELECT remaining_iqd,(SELECT count(*)::int FROM aura_reward_credit_restorations) AS restorations FROM aura_reward_grants WHERE id=1`);assert.equal(result.rows[0].remaining_iqd,5000);assert.equal(result.rows[0].restorations,1);
 assert.equal((await pool.query(`SELECT count(*)::int c FROM aura_reward_credit_review_incidents`)).rows[0].c,2);
 console.log('PASS real PostgreSQL: concurrent cancellation/return restores once, with audit');
 for (const [i,status,expiry] of [[1,'revoked',null],[2,'used','2000-01-01'] ] as const) {
  const oid=100+i;
  await pool.query(`INSERT INTO orders(id,order_number,customer_name,customer_phone,governorate,city,address) VALUES($1,$2,'Test','07000000000','Test','Test','Test')`,[oid,'manual-'+oid]);
  await pool.query(`INSERT INTO aura_reward_grants(auth_user_id,reward_id,cycle_number,request_key,reward_name,kind,credit_iqd,remaining_iqd,status,expires_at) VALUES('u1',1,$1,$2,'credit','credit',5000,3000,$3,$4)`,[i,'key'+i,status,expiry]);
  await pool.query(`INSERT INTO aura_reward_credit_uses(grant_id,order_id,amount_iqd) VALUES($1,$2,2000)`,[i+1,oid]);
  await transaction((_c,tx)=>recordCreditReview(tx,oid,'cancelled','postgres'));
  await pool.query(`UPDATE aura_reward_grants SET status='available',expires_at=NULL WHERE id=$1`,[i+1]);
  await transaction((_c,tx)=>recordCreditReview(tx,oid,'returned','postgres'));
  const r=await pool.query(`SELECT remaining_iqd,(SELECT count(*)::int FROM aura_reward_credit_restorations WHERE credit_use_id=$1) c FROM aura_reward_grants WHERE id=$1`,[i+1]);assert.equal(r.rows[0].remaining_iqd,3000);assert.equal(r.rows[0].c,0);
 }
 console.log('PASS real PostgreSQL: expired/revoked remain unreturned and in review, including repeat');
}
main().catch(e=>{console.error('FAIL PostgreSQL test:',e.message);process.exitCode=1}).finally(()=>pool.end());
