// Run with: npx tsx tests/admin_filters_race_regression.tsx
import React from 'react';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import Filters from '../src/app/admin/(panel)/filters/page';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const defer = () => { let resolve!: (v: Response) => void; return { promise: new Promise<Response>(r => { resolve = r; }), resolve }; };
const ok = (value: unknown) => new Response(JSON.stringify(value), {status:200,headers:{'content-type':'application/json'}});
const flush = async () => { for (let i=0;i<4;i++) await act(async () => { await new Promise(r=>setTimeout(r,0)); }); };
const words = (n: any): string => typeof n === 'string' ? n : (n?.children||[]).map(words).join(' ');
const row = (id: number, name: string) => ({id,name,slug:`f${id}`,type:'select',sort_order:id,is_visible:1,values:[]});
async function main() {
  const old=defer(), latest=defer(); let gets=0;
  globalThis.fetch=async (_: any, opt: any={}) => { if(opt.method) throw new Error('unexpected mutation'); return ++gets===1 ? old.promise : latest.promise; };
  let root: any;
  await act(async()=>{root=create(<React.StrictMode><Filters /></React.StrictMode>)});
  assert.equal(gets,2,'StrictMode must issue two initial requests');
  await act(async()=>{latest.resolve(ok({filters:[row(2,'Latest Filter')]}));await latest.promise}); await flush();
  await act(async()=>{old.resolve(ok({filters:[row(1,'Stale Filter')]}));await old.promise}); await flush();
  assert(JSON.stringify(root.toJSON()).includes('Latest Filter'));
  assert(!JSON.stringify(root.toJSON()).includes('Stale Filter'),'older response overwrote the latest filter list');
  await act(async()=>root.unmount());

  const stale=defer(), saved=defer(); let saveGets=0;
  globalThis.fetch=async (_: any, opt: any={}) => opt.method==='POST' ? saved.promise : ++saveGets===1 ? stale.promise : ok({filters:[row(1,'Existing Filter'),row(3,'Created Filter')]});
  await act(async()=>{root=create(<Filters/>)});
  await act(async()=>{root.root.findAllByType('button').find((b:any)=>words(b).includes('إضافة فلتر جديد')).props.onClick()});
  await act(async()=>{root.root.findByType('form').props.onSubmit({preventDefault(){}})});
  await act(async()=>{stale.resolve(ok({filters:[row(1,'Stale Load')]}));await stale.promise}); await flush();
  assert(!JSON.stringify(root.toJSON()).includes('Stale Load'),'load started before save must be discarded');
  await act(async()=>{saved.resolve(ok({filter:row(3,'Created Filter')}));await saved.promise}); await flush();
  assert(JSON.stringify(root.toJSON()).includes('Created Filter'));
  assert(JSON.stringify(root.toJSON()).includes('Existing Filter'),'deferred reload must recover the existing list');
  assert.equal(saveGets,2,'only the interrupted initial load should be retried');
  await act(async()=>root.unmount());

  const initialLoad=defer(), failedSave=defer(); let failureGets=0;
  globalThis.fetch=async (_: any, opt: any={}) => opt.method==='POST' ? failedSave.promise : ++failureGets===1 ? initialLoad.promise : ok({filters:[row(4,'Recovered Filter')]});
  await act(async()=>{root=create(<Filters/>)});
  await act(async()=>{root.root.findAllByType('button').find((b:any)=>words(b).includes('إضافة فلتر جديد')).props.onClick()});
  await act(async()=>{root.root.findByType('form').props.onSubmit({preventDefault(){}})});
  await act(async()=>{initialLoad.resolve(ok({filters:[row(1,'Stale On Failure')]}));await initialLoad.promise}); await flush();
  await act(async()=>{failedSave.resolve(new Response(JSON.stringify({error:'رفض الاختبار'}),{status:500,headers:{'content-type':'application/json'}}));await failedSave.promise}); await flush();
  assert(JSON.stringify(root.toJSON()).includes('Recovered Filter'),'failed save must not leave the initial list empty');
  assert.equal(failureGets,2);
  await act(async()=>root.unmount());
  console.log('PASS filter duplicate loads and stale load during successful or failed save');
}
main().catch(e=>{console.error(e);process.exitCode=1});
