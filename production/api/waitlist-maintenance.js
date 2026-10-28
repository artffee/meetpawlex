import { timingSafeEqual } from 'node:crypto';
import { storage } from '../lib/storage.js';
import { makeNotifier } from '../lib/notifications.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  const supplied = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const cutoff = Date.now() - 2 * 86400000;
    let cursor;
    do {
      const page = await storage.list({ prefix: 'rate/', limit: 1000, cursor });
      const old = page.blobs.filter(b => new Date(b.uploadedAt).getTime() < cutoff).map(b => b.url);
      if (old.length) await storage.remove(old);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    let sent = 0;
    if (process.env.RESEND_API_KEY && process.env.WAITLIST_NOTIFY_TO && process.env.WAITLIST_FROM_EMAIL) {
      const notify = makeNotifier({ storage });
      do {
        const page = await storage.list({ prefix: 'applications/', limit: 100, cursor });
        for (const blob of page.blobs) {
          const record = await storage.read(blob.pathname);
          if (!record || await storage.read(`notified/${record.id}.json`)) continue;
          await notify(record);
          if (++sent >= 50) break;
        }
        cursor = page.hasMore && sent < 50 ? page.cursor : undefined;
      } while (cursor);
    }
    return res.status(200).json({ ok: true, notifications: sent });
  } catch { return res.status(503).json({ error: 'Maintenance incomplete; retry later.' }); }
}
