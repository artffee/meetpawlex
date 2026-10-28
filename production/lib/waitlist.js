import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const CONSENT_VERSION = '2026-10-28';
export const BUSINESS_TYPES = ['grooming', 'vet', 'trainer', 'boarding', 'shelter', 'sitter', 'multi', 'other'];
export const VOLUMES = ['', '1–25', '26–100', '101–500', '500+'];
export class RequestError extends Error {
  constructor(status, message, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
export function hash(secret, purpose, value) {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex');
}
function same(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function challenge(secret, ip, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ at: now, nonce: randomUUID(), ip: hash(secret, 'challenge-ip', ip) })).toString('base64url');
  return `${payload}.${hash(secret, 'challenge', payload)}`;
}
export function checkChallenge(token, secret, ip, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 1000) throw new Error();
    const [payload, signature, extra] = token.split('.');
    if (extra || !same(signature, hash(secret, 'challenge', payload))) throw new Error();
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!same(data.ip, hash(secret, 'challenge-ip', ip))) throw new Error();
    const age = now - data.at;
    if (!Number.isFinite(age) || age < 1500 || age > 30 * 60 * 1000) throw new Error();
  } catch {
    throw new RequestError(400, 'Please wait a moment, then submit again. If this continues, reload the page.', 'challenge_expired');
  }
}
export function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, 'Please check the form and try again.');
  const allowed = ['first_name', 'last_name', 'email', 'business_name', 'business_type', 'monthly_customers', 'challenge', 'website', 'consent', 'verification'];
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new RequestError(400, 'Please reload the page and try again.');
  if (input.website) throw new RequestError(400, 'We could not accept this application. Please reload the page and try again.');
  const read = (key, max, required = false) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new RequestError(400, 'Please check the length and format of your details.');
    const trimmed = value.trim();
    if (required && !trimmed) throw new RequestError(400, 'Please fill in all required fields.');
    return trimmed;
  };
  const data = {
    first_name: read('first_name', 80, true), last_name: read('last_name', 80, true),
    email: read('email', 254, true).toLowerCase(), business_name: read('business_name', 160),
    business_type: read('business_type', 30, true), monthly_customers: read('monthly_customers', 20),
    challenge: read('challenge', 1500)
  };
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) throw new RequestError(400, 'Please enter a valid business email.');
  if (!BUSINESS_TYPES.includes(data.business_type) || !VOLUMES.includes(data.monthly_customers)) throw new RequestError(400, 'Please choose one of the listed options.');
  if (input.consent !== true) throw new RequestError(400, 'Please agree to application-related contact and the privacy notice.');
  return data;
}
export function makeHandler({ storage, secret, notify = async () => {}, now = Date.now, local = false }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, data) => res.status(status).json(data);
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(405, { error: 'Method not allowed.' }); }
      if (!secret || secret.length < 32) throw new Error('configuration');
      const origin = req.headers.origin;
      const allowed = new Set(['https://meetpawlex.com', 'https://www.meetpawlex.com']);
      // Vercel injects the exact current preview hostname; arbitrary *.vercel.app origins are not trusted.
      if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
      if (local) allowed.add('http://localhost:4173');
      if ((origin && !allowed.has(origin)) || req.headers['sec-fetch-site'] === 'cross-site' || (req.method === 'POST' && !origin)) throw new RequestError(403, 'Please submit using the form on meetpawlex.com.');
      const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || (local ? 'local' : '');
      if (!ip) throw new Error('client-address-unavailable');
      if (req.method === 'GET') return reply(200, { verification: challenge(secret, ip, now()) });
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new RequestError(415, 'Please submit using the website form.');
      if (Number(req.headers['content-length'] || 0) > 8192 || Buffer.byteLength(JSON.stringify(req.body ?? '')) > 8192) throw new RequestError(413, 'The application is too large. Please shorten your details.');
      const data = validate(req.body);
      checkChallenge(req.body.verification, secret, ip, now());
      const day = new Date(now()).toISOString().slice(0, 10);
      const hour = Math.floor(now() / 3600000);
      const ipKey = hash(secret, 'rate', `${day}:${ip}`);
      let permitted = false;
      for (let slot = 0; slot < 5; slot++) {
        if (await storage.create(`rate/${day}/${ipKey}/${hour}-${slot}.json`, { at: now() })) { permitted = true; break; }
      }
      if (!permitted) {
        res.setHeader('Retry-After', String(Math.ceil((3600000 - now() % 3600000) / 1000)));
        throw new RequestError(429, 'Too many attempts. Please try again in an hour.', 'rate_limited');
      }
      const id = hash(secret, 'application-email', data.email);
      const path = `applications/${id}.json`;
      const record = { ...data, id, received_at: new Date(now()).toISOString(), consent: { version: CONSENT_VERSION, application_contact: true, marketing: false, accepted_at: new Date(now()).toISOString() } };
      const created = await storage.create(path, record);
      // A duplicate must resolve to a real durable record. Never replace an existing applicant's details.
      const saved = created ? record : await storage.read(path);
      if (!saved || saved.id !== id) throw new Error('save-unconfirmed');
      try { await notify(saved); } catch { /* The durable record is the notification retry queue. */ }
      // Same response for new and duplicate applications; no addresses, identifiers or storage URLs returned.
      return reply(200, { accepted: true });
    } catch (error) {
      if (error instanceof RequestError) return reply(error.status, { error: error.message, code: error.code });
      // Deliberately do not log request bodies, email addresses, tokens, or provider errors.
      return reply(503, { error: 'We could not confirm your application. Your details are still here. Please try again; using the same email will not create a duplicate.', code: 'temporarily_unavailable' });
    }
  };
}
