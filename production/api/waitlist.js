import { makeHandler } from '../lib/waitlist.js';
import { storage } from '../lib/storage.js';
import { makeNotifier } from '../lib/notifications.js';
export default makeHandler({ storage, secret: process.env.WAITLIST_SECRET, notify: makeNotifier({ storage }) });
