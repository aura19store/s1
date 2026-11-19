// Run with: npx tsx tests/admin_identity_sync_regression.tsx
import React from 'react';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { AdminShell } from '../src/components/admin/AdminShell';
import { useAdminIdentity } from '../src/components/admin/AdminIdentity';
import Profile from '../src/app/admin/(panel)/profile/page';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).self = globalThis;
const initial = { id: 1, name: 'Old Test Name', email: 'old@example.invalid', roleId: 1, roleSlug: 'super_admin', roleName: 'مدير', permissions: [] };
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
function Child() {
  const identity = useAdminIdentity()!;
  return <button onClick={() => identity.update({name: 'Saved Test Name', email: 'saved@example.invalid'})}>{identity.user.name}</button>;
}
function tree(user: typeof initial) {
  return <AppRouterContext.Provider value={router as any}><PathnameContext.Provider value="/admin/profile"><AdminShell user={user}><Child /><Profile /></AdminShell></PathnameContext.Provider></AppRouterContext.Provider>;
}
function count(root: any, name: string) { return JSON.stringify(root.toJSON()).split(name).length - 1; }
async function main() {
  let root: any;
  await act(async () => { root = create(tree(initial)); });
  assert(count(root, 'Old Test Name') >= 3, 'shell and context should use the server identity');
  const button = root.root.findAllByType('button').find((node: any) => node.children.includes('Old Test Name'));
  await act(async () => { button.props.onClick(); });
  assert(count(root, 'Saved Test Name') >= 3, 'saved identity should update the shell and context');
  assert.equal(root.root.findAllByType('input')[0].props.value, 'Saved Test Name', 'profile follows the shared identity');
  await act(async () => { root.update(tree({ ...initial })); });
  assert(count(root, 'Saved Test Name') >= 3, 'an unchanged stale server prop must not undo a confirmed local save');
  await act(async () => { root.update(tree({ ...initial, name: 'Server Test Name', email: 'server@example.invalid' })); });
  assert(count(root, 'Server Test Name') >= 3, 'changed authoritative server identity should update shell and context');
  assert.equal(root.root.findAllByType('input')[0].props.value, 'Server Test Name');
  await act(async () => { root.root.findAllByType('input')[0].props.onChange({target:{value:'Unsaved Test Name'}}); });
  await act(async () => { root.update(tree({ ...initial, name: 'Later Server Name', email: 'later@example.invalid' })); });
  assert.equal(root.root.findAllByType('input')[0].props.value, 'Unsaved Test Name', 'server identity changes must not erase unsaved form edits');
  await act(async () => root.unmount());
  console.log('PASS AdminShell syncs authoritative identity and preserves locally confirmed updates');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
