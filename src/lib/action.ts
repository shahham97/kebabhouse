import 'server-only';
import { z } from 'zod';
import { getActor, assertPermission, type Actor } from './auth';
import { checkRateLimit, type LimitName } from './ratelimit';
import { db, type Tx } from './db';
import { writeAudit } from './audit';
import { toActionError, type ActionResult } from './errors';
import type { Permission } from '@/config/permissions';

interface ActionDef<S extends z.ZodTypeAny, R> {
  name: string;
  permission: Permission | 'public' | 'customer' | 'staff';
  schema: S;
  rateLimit?: LimitName;
  tx?: boolean;
  audit?: boolean;
  handler: (input: z.infer<S>, ctx: { actor: Actor; db: Tx }) => Promise<R>;
}

/**
 * Single mutation wrapper for every server action:
 * session -> permission -> rate limit -> Zod validation -> DB transaction -> audit -> typed ActionResult
 */
export function defineAction<S extends z.ZodTypeAny, R>(def: ActionDef<S, R>) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    try {
      const actor = await getActor();
      assertPermission(actor, def.permission);
      if (def.rateLimit) {
        await checkRateLimit(def.rateLimit, actor.key);
      }
      const input = def.schema.parse(raw);
      const run = (tx: Tx) => def.handler(input, { actor, db: tx });
      const data = def.tx ? await db.$transaction(run) : await run(db);
      if (def.audit ?? actor.type === 'staff') {
        await writeAudit(actor, def.name, { after: { ok: true } });
      }
      return { ok: true, data };
    } catch (err) {
      return toActionError(err);
    }
  };
}
