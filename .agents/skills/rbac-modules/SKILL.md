---
name: rbac-modules
description: Dynamic admin-defined roles, the permission catalogue and the admin tab registry (modules.ts). Use when adding an admin tab, a permission, a role feature, staff management, devices or PIN login.
---

# RBAC & module registry

## Model
- `config/permissions.ts`: the catalogue — a const array of `{ key, module, label, description }`. Seeded to `Permission` on deploy (upsert by key). Code checks keys, never role names.
- `Role` (admin-created, in DB) ↔ `RolePermission`. `StaffUser.roleId` + optional `UserPermissionGrant`. `Role.isSystem` for the locked **Super Admin**.
- Effective permissions = role perms ∪ grants; Super Admin = all. Cached per request (React `cache()`), invalidated by `sessionVersion`.

## Registry — the only place a tab is defined
```ts
// src/config/modules.ts
export const modules = [
  { key: 'orders',    label: 'Orders',    href: '/admin/orders',    icon: Receipt,  permission: 'orders.view' },
  { key: 'stations',  label: 'Stations',  href: '/admin/stations',  icon: ChefHat,  permission: 'kitchen.configure' },
  { key: 'inventory', label: 'Inventory', href: '/admin/inventory', icon: Boxes,    permission: 'inventory.view' },
  // …one line per tab
] as const satisfies readonly ModuleDef[];
```
Generated from it: sidebar (filtered by permissions), `requirePermission` in `admin/[module]/layout.tsx`, breadcrumbs, and the **role editor matrix** (rows = modules, columns = permissions of that module).

## Adding a tab (checklist)
1. Add permission keys to `permissions.ts` (view + manage at minimum).
2. Add one entry to `modules.ts`.
3. Create `src/app/(staff)/admin/<key>/page.tsx` → `requirePermission(...)` → query → `<DataTable/>`.
4. Actions via `defineAction` with the new permission.
5. Test: user without permission gets redirected/403 for page and action.

## Guard rails (implement in `staff/service.ts`)
- Cannot grant a permission you don't have; cannot edit your own role; cannot remove the last active Super Admin.
- Role/permission/user-disable changes bump `sessionVersion` of affected users.
- `discounts.apply` carries a max % on the role (`Role.maxDiscountPct`); enforced server-side.

## Devices & PIN
- Admin registers a device (till or station) → one-time pairing code → device cookie (hashed token in `Device`). Station devices get only their station's kitchen permissions.
- On a registered till, staff switch user by PIN (hashed with the auth library's hasher, 5 tries/min, lockout + audit).
