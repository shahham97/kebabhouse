---
description: Scaffold a new admin/manager tab using the registry, DataTable and defineAction
---

Ask for: tab key, label, entity, fields, which permissions, whether records can be disabled.

1. Follow `.agents/skills/admin-crud/SKILL.md` and `.agents/skills/rbac-modules/SKILL.md`.
2. Add permissions → registry entry → schema.ts → queries.ts → actions.ts → page.tsx + sheet form.
3. No delete action for protected entities; add an Activity panel from AuditLog.
4. Revalidate the correct cache tags.
5. Write tests: pagination, validation, forbidden page + forbidden action.
6. Run `pnpm typecheck && pnpm lint && pnpm test`. Report total lines added.
