// Owner notifications are opt-in through server-only provider settings.
// No applicant details appear in email; use the authenticated Vercel dashboard.
export function makeNotifier({ storage, env = process.env, send = fetch }) {
  return async record => {
    if (!env.RESEND_API_KEY || !env.WAITLIST_NOTIFY_TO || !env.WAITLIST_FROM_EMAIL) return false;
    const marker = `notified/${record.id}.json`;
    if (await storage.read(marker)) return true;
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `pawlex-waitlist-${record.id}` },
      body: JSON.stringify({ from: env.WAITLIST_FROM_EMAIL, to: [env.WAITLIST_NOTIFY_TO], subject: 'New PawLex beta application', text: 'A beta application has been saved privately. Open your authenticated Vercel dashboard, choose PawLex, then Storage → pawlex-beta-applications → applications to review it.\n\nhttps://vercel.com/dashboard\n\nNo applicant information is included in this email.' }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok || !(await response.json()).id) throw new Error('notification-not-accepted');
    await storage.create(marker, { sent_at: new Date().toISOString() });
    return true;
  };
}
