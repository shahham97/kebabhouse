import 'server-only';
import crypto from 'crypto';
import { db, type Tx } from './db';
import type { Actor } from './auth';

export async function writeAudit(
  actor: Actor,
  action: string,
  meta?: { entity?: string; entityId?: string; before?: unknown; after?: unknown },
  tx: Tx = db
) {
  try {
    await tx.auditLog.create({
      data: {
        actorType: actor.type.toUpperCase(),
        actorId: actor.id,
        actorName: actor.type === 'anonymous' ? 'Anonymous' : actor.name,
        action,
        entity: meta?.entity ?? '',
        entityId: meta?.entityId ?? '',
        beforeJson: meta?.before ? (JSON.parse(JSON.stringify(meta.before)) as object) : undefined,
        afterJson: meta?.after ? (JSON.parse(JSON.stringify(meta.after)) as object) : undefined,
        requestId: crypto.randomBytes(6).toString('hex'),
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}
