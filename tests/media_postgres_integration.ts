import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { translateSqlForPostgres, type DbClient, type DbParam } from '../src/db';
import { deleteMediaWithJournal } from '../src/lib/media-deletion';

const root=process.cwd();
const pool=new Pool({host:path.join(root,'.arena/pg-socket'),port:55432,database:'postgres',user:userInfo().username,max:10});
function adapter(c:PoolClient):DbClient { return {
  async queryOne<T>(sql:string,...p:DbParam[]) {const r=await c.query(translateSqlForPostgres(sql),p);return (r.rows[0] ?? null) as T | null},
  async queryAll<T>(sql:string,...p:DbParam[]) {const r=await c.query(translateSqlForPostgres(sql),p);return r.rows as T[]},
  async execute(sql:string,...p:DbParam[]) {const r=await c.query(translateSqlForPostgres(sql,{appendReturningId:true}),p);return {changes:r.rowCount ?? 0,lastInsertRowid:Number(r.rows[0]?.id ?? 0)}},
};}
async function transaction<T>(fn:(tx:DbClient)=>Promise<T>):Promise<T> {const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(adapter(c));await c.query('COMMIT');return result}catch(error){await c.query('ROLLBACK');throw error}finally{c.release()}}
async function main(){
  const where=await pool.query('SHOW data_directory');assert.equal(where.rows[0].data_directory,path.join(root,'.arena/pg-data'));
  await pool.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$");
  await pool.query('CREATE TABLE media(id BIGINT PRIMARY KEY,url TEXT NOT NULL)');
  const migration=readFileSync('supabase/migrations/0003_media_deletion_jobs.sql','utf8');await pool.query(migration);await pool.query(migration);
  const orderMigration=readFileSync('supabase/migrations/0004_order_status_operations.sql','utf8');await pool.query(orderMigration);await pool.query(orderMigration);
  const orderRls=await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.order_status_operations'::regclass");assert.equal(orderRls.rows[0].relrowsecurity,true);
  const orderPolicy=await pool.query("SELECT permissive,cmd FROM pg_policies WHERE schemaname='public' AND tablename='order_status_operations' AND policyname='aura_deny_browser_roles'");assert.deepEqual(orderPolicy.rows[0],{permissive:'RESTRICTIVE',cmd:'ALL'});
  for (const table of ['media_deletion_jobs','order_status_operations']) for(const role of ['anon','authenticated']) {
    const grants=await pool.query("SELECT has_table_privilege($1::text,format('public.%I',$2::text),'SELECT,INSERT,UPDATE,DELETE') AS allowed",[role,table]);assert.equal(grants.rows[0].allowed,false);
  }
  await transaction(async tx=>{await tx.execute("INSERT OR IGNORE INTO order_status_operations (id, order_id, expected_status, requested_status) VALUES (?, ?, ?, ?)",'3c9f2002-2717-4fc7-90c3-82c4151dddec',1,'pending','confirmed');assert(await tx.queryOne('SELECT id FROM order_status_operations WHERE id = ?', '3c9f2002-2717-4fc7-90c3-82c4151dddec'));});
  const rls=await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.media_deletion_jobs'::regclass");assert.equal(rls.rows[0].relrowsecurity,true);
  const policy=await pool.query("SELECT permissive,cmd FROM pg_policies WHERE schemaname='public' AND tablename='media_deletion_jobs' AND policyname='aura_deny_browser_roles'");assert.deepEqual(policy.rows[0],{permissive:'RESTRICTIVE',cmd:'ALL'});
  await pool.query("INSERT INTO media VALUES(1,'one'),(2,'two'),(3,'three')");let calls=0;const objects=new Set(['one','two','three']);
  const absent=async(url:string)=>{calls++;objects.delete(url)};
  const del=(id:number)=>deleteMediaWithJournal(id,transaction,'postgres',absent);
  assert.deepEqual(await Promise.all([del(1),del(1)]),['deleted','deleted']);assert.equal(calls,1);assert.equal(await del(1),'deleted');
  let fail=true;await assert.rejects(deleteMediaWithJournal(2,transaction,'postgres',async()=>{if(fail)throw Error('storage failure')}));
  assert.equal((await pool.query('SELECT state FROM media_deletion_jobs WHERE id=2')).rows[0].state,'pending');assert.equal((await pool.query('SELECT COUNT(*)::int n FROM media WHERE id=2')).rows[0].n,1);
  fail=false;assert.equal(await del(2),'deleted');assert.equal(await del(999),'not_found');
  const failingTransaction = <T>(fn:(tx:DbClient)=>Promise<T>) => transaction(tx=>fn({...tx,async execute(sql:string,...p:DbParam[]) {if(sql.startsWith('DELETE FROM media')) throw new Error('simulated database failure');return tx.execute(sql,...p)}}));
  await assert.rejects(deleteMediaWithJournal(3,failingTransaction,'postgres',absent));
  assert.equal(objects.has('three'),false);assert.equal((await pool.query('SELECT state FROM media_deletion_jobs WHERE id=3')).rows[0].state,'pending');assert.equal((await pool.query('SELECT COUNT(*)::int n FROM media WHERE id=3')).rows[0].n,1);
  assert.equal(await del(3),'deleted');
  console.log('PASS PostgreSQL media migration twice, restrictive RLS, concurrent idempotence, Storage/DB failures and retries');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
