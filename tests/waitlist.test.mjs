import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler, challenge, hash, validate } from '../production/lib/waitlist.js';
import { makeNotifier } from '../production/lib/notifications.js';
const secret = 'test-only-secret-'.repeat(4), now = Date.parse('2026-10-28T19:00:00Z'), ip = '192.0.2.1';
export function memoryStore() {
  const records = new Map();
  return { records, async create(k, v) { if (records.has(k)) return false; records.set(k, structuredClone(v)); return true; }, async read(k) { return records.get(k) ?? null; } };
}
const valid = () => ({ first_name: 'Test', last_name: 'Applicant', email: 'qa@example.com', business_name: 'Synthetic QA', business_type: 'grooming', monthly_customers: '26–100', challenge: '', website: '', consent: true, verification: challenge(secret, ip, now - 3000) });
function harness(options = {}) {
  const storage = options.storage || memoryStore();
  const handler = makeHandler({ storage, secret, now: () => now, ...options });
  return { storage, async request(body = valid(), overrides = {}) {
    const req = { method: 'POST', headers: { origin: 'https://meetpawlex.com', 'content-type': 'application/json', 'x-vercel-forwarded-for': ip }, body, ...overrides };
    const result = { statusCode: 200, headers: {} };
    const res = { setHeader(k, v) { result.headers[k] = v; }, status(s) { result.statusCode = s; return this; }, json(body) { result.body = body; return result; } };
    return await handler(req, res);
  } };
}
test('acceptance follows durable save with consent and no raw IP', async () => {
  const h = harness(); const result = await h.request();
  assert.equal(result.statusCode, 200); assert.deepEqual(result.body, { accepted: true });
  const apps = [...h.storage.records].filter(([k]) => k.startsWith('applications/'));
  assert.equal(apps.length, 1); assert.equal(apps[0][1].consent.marketing, false);
  assert.equal(apps[0][1].consent.version, '2026-10-28'); assert.ok(!JSON.stringify(apps).includes(ip));
  assert.match(result.headers['Cache-Control'], /no-store/);
});
test('duplicate emails normalize and never overwrite original details', async () => {
  const h = harness(); await h.request();
  assert.equal((await h.request({ ...valid(), email: ' QA@EXAMPLE.COM ', first_name: 'Changed' })).statusCode, 200);
  const apps = [...h.storage.records].filter(([k]) => k.startsWith('applications/'));
  assert.equal(apps.length, 1); assert.equal(apps[0][1].first_name, 'Test');
});
test('simultaneous duplicates result in one application', async () => {
  const h = harness(); const results = await Promise.all([h.request(), h.request(), h.request()]);
  assert.ok(results.every(r => r.body.accepted)); assert.equal([...h.storage.records.keys()].filter(k => k.startsWith('applications/')).length, 1);
});
test('storage failure never produces success', async () => {
  const h = harness({ storage: { async create() { throw new Error('outage'); } } });
  assert.equal((await h.request()).statusCode, 503);
});
test('missing duplicate record never produces success', async () => {
  const h = harness({ storage: { async create(k) { return !k.startsWith('applications/'); }, async read() { return null; } } });
  assert.equal((await h.request()).statusCode, 503);
});
test('sixth valid attempt receives durable rate limit across handlers', async () => {
  const storage = memoryStore();
  for (let n = 0; n < 5; n++) assert.equal((await harness({ storage }).request()).statusCode, 200);
  const result = await harness({ storage }).request(); assert.equal(result.statusCode, 429); assert.ok(result.headers['Retry-After']);
});
for (const [name, change] of [
  ['empty name', { first_name: ' ' }], ['invalid email', { email: 'not-email' }], ['long email', { email: 'a'.repeat(255) }],
  ['unknown business', { business_type: 'bad' }], ['unknown volume', { monthly_customers: '10 million' }],
  ['missing consent', { consent: false }], ['string consent', { consent: 'true' }], ['honeypot', { website: 'spam' }],
  ['oversized challenge', { challenge: 'a'.repeat(1501) }], ['object input', { first_name: {} }], ['unknown property', { admin: true }],
  ['tampered verification', { verification: 'tampered' }], ['missing verification', { verification: undefined }],
  ['expired verification', { verification: challenge(secret, ip, now - 31 * 60000) }],
  ['instant submission', { verification: challenge(secret, ip, now) }],
  ['different IP', { verification: challenge(secret, '192.0.2.2', now - 3000) }]
]) test(`rejects ${name} before storage`, async () => {
  const h = harness(); const result = await h.request({ ...valid(), ...change });
  assert.equal(result.statusCode, 400); assert.equal(h.storage.records.size, 0);
});
test('rejects cross-origin and missing origin', async () => {
  for (const origin of ['https://attacker.example', undefined]) {
    const h = harness(); assert.equal((await h.request(valid(), { headers: { origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': ip } })).statusCode, 403);
  }
});
test('requires trusted platform address and server configuration', async () => {
  assert.equal((await harness({ secret: '' }).request()).statusCode, 503);
  assert.equal((await harness().request(valid(), { headers: { origin: 'https://meetpawlex.com', 'content-type': 'application/json' } })).statusCode, 503);
});
test('rejects oversized request and wrong content type', async () => {
  const h = harness();
  assert.equal((await h.request(valid(), { headers: { origin: 'https://meetpawlex.com', 'content-type': 'text/plain', 'x-vercel-forwarded-for': ip } })).statusCode, 415);
  assert.equal((await h.request({ ...valid(), challenge: 'a'.repeat(9000) })).statusCode, 413);
});
test('GET returns a challenge only; unsupported verbs fail', async () => {
  const h = harness(); const result = await h.request(undefined, { method: 'GET' });
  assert.equal(typeof result.body.verification, 'string'); assert.equal(h.storage.records.size, 0);
  assert.equal((await h.request(valid(), { method: 'DELETE' })).statusCode, 405);
});
test('notification failure does not lose or reject accepted application', async () => {
  const h = harness({ notify: async () => { throw new Error('email outage'); } });
  assert.equal((await h.request()).statusCode, 200);
  assert.equal([...h.storage.records.keys()].filter(k => k.startsWith('applications/')).length, 1);
});
test('notifications are disabled without all provider settings', async () => {
  let sent = false; const notify = makeNotifier({ storage: memoryStore(), env: {}, send: async () => { sent = true; } });
  assert.equal(await notify({ id: 'test' }), false); assert.equal(sent, false);
});
test('owner notification excludes applicant details and is deduplicated', async () => {
  const storage = memoryStore(); let calls = 0;
  const notify = makeNotifier({ storage, env: { RESEND_API_KEY: 'test', WAITLIST_NOTIFY_TO: 'owner@example.com', WAITLIST_FROM_EMAIL: 'notify@example.com' }, send: async (_, request) => {
    calls++; assert.ok(!request.body.includes('qa@example.com')); assert.ok(!request.body.includes('Applicant'));
    assert.equal(request.headers['Idempotency-Key'], 'pawlex-waitlist-test'); return { ok: true, async json() { return { id: 'email-id' }; } };
  } });
  await notify({ ...valid(), id: 'test' }); await notify({ ...valid(), id: 'test' }); assert.equal(calls, 1);
});
test('email errors remain retryable', async () => {
  const storage = memoryStore(); const notify = makeNotifier({ storage, env: { RESEND_API_KEY: 'test', WAITLIST_NOTIFY_TO: 'owner@example.com', WAITLIST_FROM_EMAIL: 'notify@example.com' }, send: async () => ({ ok: false }) });
  await assert.rejects(notify({ id: 'test' })); assert.equal(storage.records.size, 0);
});
