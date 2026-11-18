// @ts-nocheck
// Run in isolation with: npx tsx tests/admin_ui_integration.tsx
import React from 'react';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {act,create} from 'react-test-renderer';
import Categories from '../src/app/admin/(panel)/categories/page';
import Filters from '../src/app/admin/(panel)/filters/page';
import Orders from '../src/app/admin/(panel)/orders/page';
import Users from '../src/app/admin/(panel)/users/page';
import Profile from '../src/app/admin/(panel)/profile/page';
import Media from '../src/app/admin/(panel)/media/page';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const ok=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const defer=()=>{let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>resolve=r);return {promise,resolve}};
const flush=async()=>{for(let i=0;i<8;i++)await act(async()=>{await new Promise(r=>setTimeout(r,0))})};
const text=(node:any)=>JSON.stringify(node.toJSON());
const words=(node:any):string => typeof node === 'string' ? node : (node?.children || []).map(words).join(' ');
async function category(){let saveCount=0;let req=defer();const gender={id:1,name:'رجالي',slug:'men'};
 (globalThis as any).fetch=async (url:string,opt:any={})=>{if(!opt.method)return ok({genders:[gender],categories:[]});if(opt.method==='POST'){saveCount++;return req.promise;}throw Error('unexpected')};
 let root:any;await act(async()=>{root=create(<Categories/>)});await flush();
 let createButton=root.root.findAllByType('button').find((b:any)=>words(b).includes('إنشاء تصنيف جديد'));await act(async()=>{createButton.props.onClick()});
 let input=root.root.findAllByType('input').find((i:any)=>i.props.placeholder?.startsWith('مثال:'));await act(async()=>{input.props.onChange({target:{value:'تصنيف اختبار'}})});
 const submit=()=>root.root.findByType('form').props.onSubmit({preventDefault(){}});
 await act(async()=>{submit();submit()});assert.equal(saveCount,1);assert(text(root).includes('جاري الحفظ'));
 await act(async()=>{req.resolve(ok({error:'خطأ تجريبي'},400));await req.promise});await flush();assert(text(root).includes('خطأ تجريبي'));assert.equal(root.root.findAllByType('input').find((i:any)=>i.props.placeholder?.startsWith('مثال:')).props.value,'تصنيف اختبار');
 req=defer();await act(async()=>{submit()});assert.equal(saveCount,2);assert(!text(root).includes('الفئة المنشأة'));
 await act(async()=>{req.resolve(ok({message:'نجاح',category:{id:7,gender_id:1,name:'الفئة المنشأة',slug:'test',description:'',image_url:'',sort_order:1,is_visible:1,product_count:0}},201));await req.promise});await flush();assert(text(root).includes('الفئة المنشأة'));console.log('PASS React category double submit, loading, server failure retains input, success updates list');await act(async()=>root.unmount());}
async function filters(){let pending=new Map<number,ReturnType<typeof defer>>();let calls:number[]=[];let old=defer();let getCount=0;const rows=[1,2,3].map(id=>({id,name:'Filter'+id,slug:'f'+id,type:'select',sort_order:id,is_visible:1,values:[]}));
 (globalThis as any).fetch=async(url:string,opt:any={})=>{if(opt.method==='DELETE'){let id=Number(url.split('/').pop());calls.push(id);let d=defer();pending.set(id,d);return d.promise;}if(opt.method==='PUT')return ok({});if(!opt.method){getCount++;return getCount===1?ok({filters:rows}):old.promise;}throw Error('unexpected')};
 let root:any;await act(async()=>{root=create(<Filters/>)});await flush();
 const row=(id:number)=>root.root.findAll((n:any)=>n.props.draggable===true).find((n:any)=>words(n).includes('Filter'+id));
 async function remove(id:number){await act(async()=>{row(id).findAllByType('button').find((b:any)=>b.props.title==='حذف الفلتر').props.onClick()});let btn=root.root.findAllByType('button').find((b:any)=>b.children.includes('تأكيد الحذف'));await act(async()=>{btn.props.onClick();btn.props.onClick()});}
 await remove(1);await remove(2);assert.deepEqual(calls,[1,2]);assert(!text(root).includes('Filter1')&&!text(root).includes('Filter2'));
 await act(async()=>{row(3).findAllByType('button').find((b:any)=>b.props.title==='إخفاء').props.onClick()});await flush();
 await act(async()=>{pending.get(2)!.resolve(ok({message:'ok'}));await pending.get(2)!.promise});await flush();
 await act(async()=>{pending.get(1)!.resolve(ok({error:'no'},500));await pending.get(1)!.promise});await flush();assert(text(root).includes('Filter1'));assert(!text(root).includes('Filter2'));
 await act(async()=>{old.resolve(ok({filters:rows}));await old.promise});await flush();assert(text(root).includes('Filter1'));assert(!text(root).includes('Filter2'));console.log('PASS React filter concurrent deletes, duplicate suppression, reversed success/failure, rollback and stale list');await act(async()=>root.unmount());}
async function orders(){let requests=0;let req=defer();let gets=0;let order={id:1,order_number:'ONE',customer_name:'Client',customer_phone:'123',governorate:'City',payment_method:'cash',items_count:1,total_iqd:1000,status:'pending',created_at:'2024-01-01'};
 (globalThis as any).fetch=async(url:string,opt:any={})=>{if(opt.method==='PATCH'){requests++;return req.promise}gets++;return ok({orders:[order]})};
 let root:any;await act(async()=>{root=create(<Orders/>)});await flush();let select=()=>root.root.findAllByType('select').find((s:any)=>s.props.value==='pending'||s.props.value==='confirmed');let original=select();
 await act(async()=>{original.props.onChange({target:{value:'confirmed'}});original.props.onChange({target:{value:'confirmed'}})});assert.equal(requests,1);assert.equal(select().props.value,'confirmed');assert.equal(select().props.disabled,true);
 await act(async()=>{req.resolve(ok({error:'rejected'},400));await req.promise});await flush();assert.equal(select().props.value,'pending');assert(text(root).includes('rejected'));
 req=defer();await act(async()=>{select().props.onChange({target:{value:'confirmed'}})});await act(async()=>{req.resolve(ok({message:'ok'}));await req.promise});await flush();assert.equal(select().props.value,'confirmed');assert.equal(gets,1);console.log('PASS React order optimistic status, duplicate suppression, rollback and no list reload');await act(async()=>root.unmount());}
async function ordersNetwork(){let patch=0;const order={id:1,order_number:'T1',customer_name:'Client',customer_phone:'123',governorate:'City',payment_method:'cash',items_count:1,total_iqd:1000,status:'pending',created_at:'2024-01-01'};
 (globalThis as any).fetch=async(url:string,opt:any={})=>{if(opt.method==='PATCH'){patch++;if(patch===1)throw new TypeError('lost response');if(patch===2)return ok({error:'conflict',status:'confirmed'},409);if(patch===3||patch===4)throw new DOMException('timeout','TimeoutError');return ok({message:'ok'})}return ok({orders:[order]})};
 let root:any;await act(async()=>{root=create(<Orders/>)});await flush();const select=()=>root.root.findAllByType('select').find((s:any)=>['pending','confirmed','processing'].includes(s.props.value));await act(async()=>{select().props.onChange({target:{value:'confirmed'}})});await flush();assert.equal(patch,2);assert.equal(select().props.value,'confirmed');assert.equal(select().props.disabled,false);
 await act(async()=>{select().props.onChange({target:{value:'processing'}})});await flush();assert.equal(patch,4);assert.equal(select().props.disabled,true);assert(text(root).includes('غير مؤكدة'));await act(async()=>{root.root.findAllByType('button').find((b:any)=>words(b).includes('إعادة التحقق')).props.onClick()});await flush();assert.equal(patch,5);assert.equal(select().props.value,'processing');assert.equal(select().props.disabled,false);console.log('PASS React order lost response, timeout, uncertain state and conditional retry');await act(async()=>root.unmount());}
async function users(){const fixturePassword=randomUUID();let pending=defer(),calls=0,gets=0;const rows=[1,2].map(id=>({id,name:'User'+id,email:'user'+id+'@example.invalid',role_id:1,role_slug:'super_admin',role_name:'Admin',is_active:1,last_login_at:null}));
 (globalThis as any).fetch=async(url:string,opt:any={})=>{if(url==='/api/admin/auth/me')return ok({user:{id:1}});if(opt.method==='DELETE'){calls++;return pending.promise}gets++;return ok({users:rows,roles:[]})};
 let root:any;await act(async()=>{root=create(<Users/>)});await flush();
 const tr=(id:number)=>root.root.findAllByType('tr').find((n:any)=>words(n).includes('User'+id));
 await act(async()=>{tr(1).findAllByType('button').find((b:any)=>b.props.title==='تعديل').props.onClick()});let inputs=root.root.findAllByType('input');let password=inputs.find((x:any)=>x.props.type==='password');await act(async()=>{password.props.onChange({target:{value:fixturePassword}})});assert(text(root).includes('كلمة المرور الحالية'));
 await act(async()=>{root.root.findAllByType('button').find((b:any)=>b.props['aria-label']==='إغلاق').props.onClick()});
 await act(async()=>{tr(2).findAllByType('button').find((b:any)=>b.props.title==='حذف').props.onClick()});let confirm=root.root.findAllByType('button').find((b:any)=>b.children.includes('تأكيد الحذف'));await act(async()=>{confirm.props.onClick();confirm.props.onClick()});assert.equal(calls,1);assert(!text(root).includes('User2'));await act(async()=>{pending.resolve(ok({error:'refused'},403));await pending.promise});await flush();assert(text(root).includes('User2'));assert(text(root).includes('refused'));assert.equal(gets,1);console.log('PASS React self-password prompt, optimistic user deletion, duplicate suppression, rollback without reload');await act(async()=>root.unmount());}
async function profile(){const fixtureOld=randomUUID(), fixtureNew=randomUUID();let pending=defer(),calls=0;
 (globalThis as any).fetch=async(url:string,opt:any={})=>{if(opt.method==='PATCH'){calls++;return pending.promise}return ok({user:{name:'Profile Name',email:'user@example.invalid'}})};
 let root:any;await act(async()=>{root=create(<Profile/>)});await flush();const passwords=root.root.findAllByType('input').filter((i:any)=>i.props.type==='password');await act(async()=>{passwords[0].props.onChange({target:{value:fixtureOld}});passwords[1].props.onChange({target:{value:fixtureNew}});passwords[2].props.onChange({target:{value:fixtureNew}})});
 let submit=()=>root.root.findByType('form').props.onSubmit({preventDefault(){}});await act(async()=>{submit();submit()});assert.equal(calls,1);await act(async()=>{pending.resolve(ok({error:'wrong'},400));await pending.promise});await flush();assert(text(root).includes('wrong'));assert.equal(root.root.findAllByType('input').filter((i:any)=>i.props.type==='password')[1].props.value,fixtureNew);
 pending=defer();await act(async()=>{submit()});await act(async()=>{pending.resolve(ok({message:'saved',user:{name:'Profile Name',email:'user@example.invalid'}}));await pending.promise});await flush();assert(text(root).includes('saved'));assert.equal(root.root.findAllByType('input').filter((i:any)=>i.props.type==='password')[1].props.value,'');console.log('PASS React profile duplicate suppression, failure retains input and success clears passwords');await act(async()=>root.unmount());}
async function media(){let pending=new Map<number,ReturnType<typeof defer>>(), calls:number[]=[];const rows=[1,2].map(id=>({id,filename:'Image'+id,url:'/images/'+id,category:'products',alt_text:'Image'+id,created_at:'2024-01-01'}));
 (globalThis as any).fetch=async(url:string,opt:any={})=>{if(opt.method==='DELETE'){let id=Number(new URL('http://test'+url).searchParams.get('id'));calls.push(id);let d=defer();pending.set(id,d);return d.promise}return ok({items:rows})};
 let root:any;await act(async()=>{root=create(<Media/>)});await flush();
 const card=(id:number)=>root.root.findAll((n:any)=>n.type==='div'&&n.props.className?.includes('overflow-hidden flex flex-col')).find((n:any)=>words(n).includes('Image'+id));
 async function remove(id:number){await act(async()=>{card(id).findAllByType('button').find((b:any)=>b.props.title==='حذف الصورة').props.onClick()});let confirm=root.root.findAllByType('button').find((b:any)=>b.children.includes('تأكيد الحذف'));await act(async()=>{confirm.props.onClick();confirm.props.onClick()})}
 await remove(1);await remove(2);assert.deepEqual(calls,[1,2]);assert(!text(root).includes('Image1')&&!text(root).includes('Image2'));
 await act(async()=>{pending.get(2)!.resolve(ok({message:'ok'}));await pending.get(2)!.promise});await flush();await act(async()=>{pending.get(1)!.resolve(ok({error:'retry'},503));await pending.get(1)!.promise});await flush();assert(text(root).includes('Image1'));assert(!text(root).includes('Image2'));assert(text(root).includes('retry'));console.log('PASS React media optimistic concurrent delete, duplicate suppression, reverse responses and retryable failure rollback');await act(async()=>root.unmount());}
(async()=>{await category();await filters();await orders();await ordersNetwork();await users();await profile();await media()})().catch(e=>{console.error(e);process.exitCode=1});
