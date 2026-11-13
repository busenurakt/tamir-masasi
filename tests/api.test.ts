import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { openStore } from '../server/store.js';
import type { Repair } from '../shared/domain.js';

async function fixture(seed = false) {
  const folder = await mkdtemp(join(tmpdir(), 'tamir-api-'));
  const url = `file:${join(folder, 'test.sqlite').replaceAll('\\', '/')}`;
  const store = await openStore(url, seed);
  const app = createApp(store);
  // libSQL native handles may release after GC on Windows. Keep isolated temp files;
  // do not let native unlink timing mask the actual assertion result.
  return {store, app, url, async close() {await app.close(); store.close();}};
}
const intake = (overrides = {}) => ({customer: 'Ada Test', contact: '', item: 'Test kahve makinesi', category: 'Küçük ev aleti' as const, issue: 'Su ısıtıyor ancak pompa çalışmıyor.', requestId: randomUUID(), ...overrides});

test('empty initialization remains empty when reopened with seed enabled', async () => {
  const f = await fixture();
  try {assert.deepEqual(await f.store.list(), []); const second = await openStore(f.url, true); try {assert.deepEqual(await second.list(), []);} finally {second.close();}} finally {await f.close();}
});
test('demo seed runs once and all statuses have matching event history', async () => {
  const f = await fixture(true);
  try {
    const rows = await f.store.list(); assert.equal(rows.length, 6);
    for (const row of rows) {const detail = await f.store.detail(row.id); assert.equal(detail.events.at(-1)!.status, row.status); assert.equal(detail.events.length, row.version);}
    const second = await openStore(f.url, true); try {assert.equal((await second.list()).length, 6);} finally {second.close();}
  } finally {await f.close();}
});
test('intake persists and never exposes request fingerprints', async () => {
  const f = await fixture();
  try {
    const created = await f.app.inject({method: 'POST', url: '/api/repairs', payload: intake()});
    assert.equal(created.statusCode, 201); const repair = created.json<Repair>(); assert.equal(repair.status, 'received'); assert.equal(repair.version, 1); assert.equal('fingerprint' in repair, false); assert.equal('requestId' in repair, false);
    const second = await openStore(f.url, false); try {assert.equal((await second.detail(repair.id)).repair.item, repair.item);} finally {second.close();}
    assert.equal((await f.app.inject('/api/repairs')).headers['cache-control'], 'no-store');
  } finally {await f.close();}
});
test('same request retries create only one ticket, conflicting payload returns 409', async () => {
  const f = await fixture();
  try {
    const payload = intake();
    const first = await f.app.inject({method: 'POST', url: '/api/repairs', payload});
    const repeated = await f.app.inject({method: 'POST', url: '/api/repairs', payload});
    assert.equal(repeated.json().id, first.json().id);
    assert.equal((await f.store.list()).length, 1);
    assert.equal((await f.store.detail(first.json().id)).events.length, 1);
    assert.equal((await f.app.inject({method: 'POST', url: '/api/repairs', payload: {...payload, item: 'Different item'}})).statusCode, 409);
  } finally {await f.close();}
});
test('workflow enforces transitions, preserves notes and seals collected tickets', async () => {
  const f = await fixture();
  try {
    let row = await f.store.create(intake());
    const url = `/api/repairs/${row.id}`;
    assert.equal((await f.app.inject({method:'PATCH',url,payload:{version:1,status:'collected',note:'Erken teslim'}})).statusCode,409);
    assert.equal((await f.store.detail(row.id)).events.length,1);
    for (const status of ['working', 'parts', 'working', 'ready', 'collected'] as const) {
      const response = await f.app.inject({method:'PATCH',url,payload:{version:row.version,status,note:`İşlem: ${status}`}});
      assert.equal(response.statusCode,200,response.body); row = response.json();
    }
    const detail = await f.store.detail(row.id); assert.equal(detail.events.length,6); assert.equal(detail.events[2].note,'İşlem: parts');
    assert.equal((await f.app.inject({method:'PATCH',url,payload:{version:row.version,status:'working',note:'Yeniden aç'}})).statusCode,409);
  } finally {await f.close();}
});
test('unrepairable branch still requires explicit collection', async () => {
  const f = await fixture();
  try {let row = await f.store.create(intake()); for(const status of ['working','unrepairable','collected'] as const) row = await f.store.change(row.id,{status,note:'Müşteriye bilgi verildi.',version:row.version}); assert.equal((await f.store.detail(row.id)).events.length,4);} finally {await f.close();}
});
test('stale version cannot overwrite a committed change', async () => {
  const f = await fixture();
  try {const row = await f.store.create(intake()); await f.store.change(row.id,{status:'working',note:'Kontrol başladı.',version:1}); const response = await f.app.inject({method:'PATCH',url:`/api/repairs/${row.id}`,payload:{status:'working',note:'Eski sekme.',version:1}}); assert.equal(response.statusCode,409); assert.equal((await f.store.detail(row.id)).events.length,2);} finally {await f.close();}
});
test('two connections racing on one version commit one event', async () => {
  const f = await fixture(); const second = await openStore(f.url,false);
  try {
    const row = await f.store.create(intake());
    const results = await Promise.allSettled([f.store.change(row.id,{status:'working',note:'Birinci işlem.',version:1}), second.change(row.id,{status:'working',note:'İkinci işlem.',version:1})]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const failure = results.find(r=>r.status==='rejected') as PromiseRejectedResult;
    assert.equal(failure.reason.statusCode,409);
    const detail = await f.store.detail(row.id); assert.equal(detail.repair.version,2); assert.equal(detail.events.length,2);
  } finally {second.close(); await f.close();}
});
test('field validation rejects short, oversized, unknown and incorrectly typed values', async () => {
  const f = await fixture();
  try {
    for (const override of [{customer:' '},{item:'x'},{issue:'short'},{category:'Other'},{requestId:'invalid'},{customer:123},{issue:'x'.repeat(1001)},{status:'ready'}]) {
      const response = await f.app.inject({method:'POST',url:'/api/repairs',payload:intake(override)}); assert.equal(response.statusCode,422,response.body);
    }
    assert.equal((await f.store.list()).length,0);
    const row = await f.store.create(intake());
    for(const payload of [{status:'working',note:' ',version:1},{status:'working',note:'Valid note',version:'1'},{status:'fake',note:'Valid note',version:1}]) assert.equal((await f.app.inject({method:'PATCH',url:`/api/repairs/${row.id}`,payload})).statusCode,422);
    assert.equal((await f.store.detail(row.id)).events.length,1);
  } finally {await f.close();}
});
test('input trimming and SQL-like text are stored as plain data', async () => {
  const f = await fixture();
  try {const row = await f.store.create(intake({customer:"  O'Brien  ",issue:"'); DROP TABLE repairs; --"})); assert.equal(row.customer,"O'Brien"); assert.equal((await f.store.list()).length,1);} finally {await f.close();}
});
test('missing and malformed IDs and unknown API endpoints return useful errors', async () => {
  const f = await fixture();
  try {for(const id of ['0','abc','-3','1.2']) assert.equal((await f.app.inject(`/api/repairs/${id}`)).statusCode,400); assert.equal((await f.app.inject('/api/repairs/999')).statusCode,404); assert.equal((await f.app.inject('/api/unknown')).statusCode,404);} finally {await f.close();}
});
test('HTTP rejects foreign origins, non-JSON, malformed JSON, and oversized requests', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.app.inject({method:'POST',url:'/api/repairs',headers:{origin:'https://external.example'},payload:intake()})).statusCode,403);
    assert.equal((await f.app.inject({method:'POST',url:'/api/repairs',headers:{'content-type':'text/plain'},payload:'text'})).statusCode,415);
    assert.equal((await f.app.inject({method:'POST',url:'/api/repairs',headers:{'content-type':'application/json'},payload:'{'})).statusCode,400);
    assert.equal((await f.app.inject({method:'POST',url:'/api/repairs',payload:intake({issue:'x'.repeat(9000)})})).statusCode,413);
    assert.equal((await f.store.list()).length,0);
  } finally {await f.close();}
});
test('fixed APP_ORIGIN is honored for future reverse proxies', async () => {
  const f = await fixture(); const app = createApp(f.store,{origin:'https://tamir.example'});
  try {assert.equal((await app.inject({method:'POST',url:'/api/repairs',headers:{origin:'https://tamir.example'},payload:intake()})).statusCode,201);} finally {await app.close(); await f.close();}
});
