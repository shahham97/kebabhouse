---
name: server-actions
description: How to write any mutation (server action) in this repo using defineAction — auth, permission, rate limit, Zod validation, transaction, audit and typed results. Use whenever creating or changing a form submit, button action or any write to the database.
---

# Server actions with `defineAction`

## Goal
Every write path is ~10–20 lines of business code. Auth, permissions, validation, rate limiting, audit and error mapping are handled once in `src/lib/action.ts`.

## The wrapper (reference — keep the real one this small)
```ts
// src/lib/action.ts
import 'server-only';
import { z } from 'zod';
import { getActor, assertPermission, type Actor } from './auth';
import { limit, type LimitName } from './ratelimit';
import { db, type Tx } from './db';
import { audit } from './audit';
import { toActionError, type ActionResult } from './errors';
import type { Permission } from '@/config/permissions';

type Def<S extends z.ZodTypeAny, R> = {
  name: string;
  permission: Permission | 'public' | 'customer';
  schema: S;
  rateLimit?: LimitName;
  tx?: boolean;            // wrap handler in a DB transaction
  audit?: boolean;         // default true for staff actions
  handler: (input: z.infer<S>, ctx: { actor: Actor; db: Tx }) => Promise<R>;
};

export function defineAction<S extends z.ZodTypeAny, R>(d: Def<S, R>) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    try {
      const actor = await getActor();                          // session or anonymous
      assertPermission(actor, d.permission);                   // throws Forbidden
      if (d.rateLimit) await limit(d.rateLimit, actor.key);    // throws RateLimited
      const input = d.schema.parse(raw);                       // throws ValidationError
      const run = (tx: Tx) => d.handler(input, { actor, db: tx });
      const data = d.tx ? await db.$transaction(run) : await run(db);
      if (d.audit ?? actor.type === 'staff') await audit(actor, d.name, input, data);
      return { ok: true, data };
    } catch (e) { return toActionError(e); }                  // safe message + requestId
  };
}
```

## Usage pattern
```ts
// src/modules/catalog/actions.ts
'use server';
export const disableVariant = defineAction({
  name: 'catalog.variant.disable',
  permission: 'catalog.manage',
  schema: z.object({ variantId: z.string() }),
  tx: true,
  handler: async ({ variantId }, { db }) => {
    await db.variant.update({ where: { id: variantId }, data: { active: false } });
    after(() => revalidateTag(tags.menu));
  },
});
```

## Rules
- Schemas live in `modules/<domain>/schema.ts` and are imported by both the form and the action.
- Side effects that leave the process (Stripe, email, Ably, revalidate) run **after commit** via `after()`.
- Return plain serialisable data. Never return secrets or other users' data.
- Client: `useActionState`/form `action`, show field errors from `error.fieldErrors`, toast otherwise; disable submit while pending; send an idempotency key for create-order style actions.
- Do not call `getSession()` / check roles manually inside handlers — the wrapper did it. Resource-level ownership checks DO belong in the handler/service (`assertOwns(actor, order)`).
- Test: one integration test per action for happy path + forbidden + invalid input.
