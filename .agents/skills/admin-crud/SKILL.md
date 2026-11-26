---
name: admin-crud
description: Build an admin/manager tab fast and consistently using the module registry, generic DataTable, shared Zod form pattern and defineAction. Use when creating or extending any admin list/detail/edit screen (categories, products, vendors, deals, staff, CMS, settings…).
---

# Admin CRUD in ~100 lines

## Steps
1. **Permissions + registry**: add `x.view`, `x.manage` to `config/permissions.ts`; one entry in `config/modules.ts`.
2. **Schema** `modules/x/schema.ts`: `export const xInput = z.object({...})` — used by form and action.
3. **Query** `modules/x/queries.ts`:
```ts
export async function listX({ cursor, q, take = 25 }: ListParams) {
  return db.x.findMany({ where: q ? { name: { contains: q } } : {}, take: take + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }), orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, active: true, updatedAt: true } });
}
```
4. **Actions** `modules/x/actions.ts`: `createX`, `updateX`, `setXActive` via `defineAction` (no delete action for protected entities).
5. **Page** `app/(staff)/admin/x/page.tsx`: `await requirePermission('x.view')` → `listX(searchParams)` → `<DataTable columns={xColumns} rows={...} />` + `<XSheet/>` (shadcn Sheet with the form).
6. **Revalidate** affected cache tags in the action (`after(() => revalidateTag(tags.menu))`).
7. **Tests**: list paginates; create validates; non-permitted user blocked (page + action).

## DataTable contract (one component for all tabs)
Props: `columns`, `rows`, `nextCursor`, `filters` (declarative), `exportName`. State lives in the URL (`?q=&cursor=&sort=`) so lists are shareable and server-rendered. CSV export calls a server action that streams the same query without `take` but in batches.

## Protected-entity rules
- Categories: edit only (no disable). Products/variants: disable, never delete. Inventory items: edit only. Orders/ledgers: read-only except via domain actions.
- Show history: an "Activity" panel per record reading `AuditLog` by entity id.
