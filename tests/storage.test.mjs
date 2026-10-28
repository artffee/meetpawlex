import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStorage } from '../production/lib/storage.js';
function sdkMock() {
  const records = new Map();
  return { records, async put(path, data, options) {
    assert.equal(options.access, 'private'); assert.equal(options.allowOverwrite, false);
    assert.equal(options.addRandomSuffix, false);
    if (records.has(path)) throw new Error('conflict'); records.set(path, data);
  }, async get(path, options) {
    assert.equal(options.useCache, false); assert.equal(options.access, 'private');
    return records.has(path) ? { statusCode: 200, stream: new Response(records.get(path)).body } : null;
  }, async list(options) {
    return { blobs: [...records.keys()].filter(k => k.startsWith(options.prefix)).map(pathname => ({ pathname, url: 'https://private.invalid/' + pathname })) };
  } };
}
test('preview and production application keys and quotas are isolated', async () => {
  const sdk=sdkMock(), live=makeStorage(sdk,'production'), preview=makeStorage(sdk,'preview');
  assert.equal(await live.create('applications/a.json',{source:'live'}),true);
  assert.equal(await preview.create('applications/a.json',{source:'preview'}),true);
  assert.equal((await live.read('applications/a.json')).source,'live');
  assert.equal((await preview.read('applications/a.json')).source,'preview');
  assert.equal(await live.create('rate/slot.json',{at:1}),true);
  assert.equal(await preview.create('rate/slot.json',{at:2}),true);
});
test('adapter confirms real conflicts and preserves the existing record', async () => {
  const sdk=sdkMock(), storage=makeStorage(sdk,'production');
  await storage.create('applications/a.json',{name:'original'});
  assert.equal(await storage.create('applications/a.json',{name:'changed'}),false);
  assert.equal((await storage.read('applications/a.json')).name,'original');
});
test('adapter rethrows write failures when no saved object exists', async () => {
  const sdk=sdkMock();sdk.put=async()=>{throw new Error('unavailable');};
  await assert.rejects(makeStorage(sdk,'production').create('applications/a.json',{}),/unavailable/);
});
test('listing stays inside its environment and returns logical paths', async () => {
  const sdk=sdkMock(), live=makeStorage(sdk,'production'), preview=makeStorage(sdk,'preview');
  await live.create('applications/a.json',{}); await preview.create('applications/b.json',{});
  const result=await live.list({prefix:'applications/'});
  assert.deepEqual(result.blobs.map(b=>b.pathname),['applications/a.json']);
});
