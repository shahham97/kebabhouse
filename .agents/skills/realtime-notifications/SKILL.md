---
name: realtime-notifications
description: Ably realtime for Till, station screens and customer tracking, plus the notification dispatcher (Resend email, Web Push, optional SMS) with quotas and idempotency. Use for live updates, chimes, order tracking pages and any customer/staff notification.
---

# Realtime & notifications

## Realtime (Ably) — keep it this small
```ts
// src/lib/realtime.ts (server)
export const channels = {
  till: (s: string) => `store:${s}:till`,
  station: (s: string, code: string) => `store:${s}:station:${code}`,
  order: (publicId: string) => `order:${publicId}`,
};
export function publishAfterCommit(channel: string, name: string, data: { id: string; status?: string }) {
  after(() => ably.channels.get(channel).publish(name, data));   // ids/status only, never PII
}
```
- Client hook `useLiveRefresh(channel)`: subscribe → on message `router.refresh()` (or revalidate the query) → also refetch on reconnect, on `visibilitychange`, and every 60 s. While Ably is disconnected, fall back to 15 s refetch.
- Token auth at `/api/ably/token`: capability by actor — station device: `subscribe` on its station channel; till: till + stations of its store; customer: `subscribe` on `order:{publicId}` only after verifying session/signed token. Never ship the Ably API key to the browser.
- Sounds: user-gesture-unlocked audio, "new order" and "ready" chimes, volume in settings; Wake Lock on Till/Station.
- Budget: Ably free has a monthly message cap and 200 concurrent connections — one connection per screen; don't publish per keystroke.

## Notifications
```ts
// src/lib/notify/dispatch.ts
export async function notify(event: NotifyEvent, orderId: string) {
  const o = await loadOrderForNotify(orderId);
  for (const ch of channelsFor(event, o)) {                 // from the event×channel table in MASTER_PROMPT §13
    const key = `${orderId}:${event}:${ch}`;
    if (!(await claimLog(key))) continue;                  // unique NotificationLog.key → never double-send
    await senders[ch](event, o).then(ok => markSent(key), err => markFailed(key, err));
  }
}
```
- Called from post-commit (`after()`); never blocks or fails the order.
- Email: React Email templates in `/emails`, Resend from a verified domain (SPF, DKIM, DMARC). Track daily count (`EmailQuotaDay`); near the free-tier daily cap, skip non-critical emails (status updates) and rely on push/live page; dashboard warning.
- Web Push: VAPID keys in env; `PushSubscription` per customer/device; prompt only after the first order ("Want a ping when it's ready?").
- SMS: interface only, disabled by default; provider chosen by owner later.
- Every customer message includes the tracking link `/order/{publicId}?t={signed}` (HMAC, expires after 30 days).
- Failed sends are retried by the nightly job (max 3) — stale "ready" messages are not retried after the order is completed.
