# Beta application operations

Signup: https://meetpawlex.com/#waitlist

## Private applications

In the authenticated Vercel dashboard, open project **pawlex** → Storage →
**pawlex-beta-applications** → `applications/`. Each JSON record contains the
original application, receipt time and versioned application-contact consent.
The store is PRIVATE and US East (iad1). Do not change it to public or put
exports in GitHub. Only authorized Vercel account administrators may review it.

Normalized email has one HMAC-derived pathname. Retries and case/whitespace
variants return the same generic receipt without overwriting the first record.
There is no public list/read endpoint. Applicants cannot use resubmission to
change somebody else's record. No IP address is stored in application records.

Configured server variables: `BLOB_READ_WRITE_TOKEN`, `WAITLIST_SECRET`,
`CRON_SECRET`. Do not rotate WAITLIST_SECRET without migrating application keys:
it is the stable HMAC key used for duplicate detection as well as form tokens.

Spam controls: honeypot, signed expiring challenge bound to Vercel's trusted
client address, minimum form time, strict schema and length checks, same-origin
requests, and five valid attempts per network address per hour. The limit is
atomic and shared across function instances through private conditional writes.
These controls reduce automated abuse; they are not a CAPTCHA. A large shared
network can hit the limit; the form preserves details and explains when to retry.
Daily maintenance deletes rate markers older than 48 hours. Application data is
retained for beta management until deletion is requested or beta retention review.

## Email notifications: disabled pending setup

Receipt confirmation currently appears on the website. There is no claim that
an email was sent, no guaranteed response time, and no marketing opt-in.

To enable private OWNER notifications:

1. Verify a PawLex sending domain in Resend. The connected account currently has
   no verified sending domains and no PawLex domain. Resolve its domain-slot limit
   in the Resend dashboard; do not delete another site's domain without approval.
2. Create a domain-scoped sending key and set `RESEND_API_KEY` in Vercel's encrypted
   production environment. Set `WAITLIST_FROM_EMAIL` to that verified sender.
3. Confirm the owner's destination inbox and set `WAITLIST_NOTIFY_TO`. No inbox was
   confirmed during this implementation, so this variable remains unset.
4. Update the privacy page to reflect enabled alerts, deploy, and test delivery.

The alert contains only a generic notice and a link to the authenticated Vercel
dashboard, never names, emails or applicant details. The accepted application is
also the durable retry queue; the daily job retries unnotified applications, up
to 50 per run. Resend idempotency keys cover retries within its provider window.
A rare crash after email delivery but before recording the sent marker can cause
an extra generic alert when retried after that window. Applications stay saved
when email is down. No applicant confirmation emails are implemented or promised.

The Vercel cron calls `/api/waitlist-maintenance` daily at 06:17 UTC with
`Authorization: Bearer $CRON_SECRET`; unauthenticated calls return 401.
Verify the job in Vercel after release. If maintenance fails, retry the job from
the dashboard. Review applications directly while email remains disabled.

## Deletion and support

Use the private storage dashboard to locate the record by its contents, verify
the requester using the original email, then delete that application and its
matching `notified/` marker. Do not share public storage links. Keep beta access
communications separate from marketing, which needs its own consent workflow.

Use only clearly labeled synthetic addresses at example.com for release tests.
Remove those synthetic QA records after verification or mark them as test data.
