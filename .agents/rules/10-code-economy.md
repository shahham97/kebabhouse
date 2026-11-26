---
trigger: always_on
description: Write the least code that is correct, secure and clear
---

# Code economy — "10 lines, not 100"

Before writing code, walk this ladder and stop at the first step that solves it:
1. **Does it already exist in this repo?** (`lib/`, `modules/*/service.ts`, shared components) → reuse it.
2. **Does the platform do it?** Next.js (caching, `revalidateTag`, `after()`, `next/image`, metadata, route groups), React (forms, `useOptimistic`, Suspense), the database (unique keys, FKs, conditional `UPDATE … WHERE status = ?`, `GROUP BY`), Prisma (`$transaction`, nested writes, `select`), Zod, shadcn/ui.
3. **Does an already-installed library do it?**
4. **Is there a small, well-maintained library?** → propose it with a one-line justification in `docs/DECISIONS.md`; ask before installing.
5. Only then write custom code — the minimum, with a test.

## Concrete rules
- One mutation wrapper (`defineAction`), one table component (`DataTable`), one form pattern, one money helper, one notify dispatcher, one realtime helper. Do not create parallel versions.
- No generic repository/DAO layer over Prisma. No "manager/handler/factory" classes for things a function does.
- Prefer data-driven configs (tables of transitions, registries, permission lists) over branching code.
- Derive, don't duplicate: types from Zod (`z.infer`) and Prisma; UI labels from the registry.
- No speculative abstraction: build for the requirement in front of you; leave a `// TODO(phase-2)` with the ticket, not a framework.
- Delete dead code in the same change. No commented-out blocks.
- Files < 250 lines, functions < 40 lines as a guideline; split by responsibility.
- Comments explain *why*, not *what*.
- But never trade away: input validation, permission checks, transactions, idempotency, error handling, accessibility, tests. Short ≠ unsafe.

## Self-check before finishing
- Could any new function be replaced by an existing helper or a platform feature?
- Did I add a dependency, a new pattern, or a second way of doing something? If yes, justify or remove.
- Is every line covered by a test or exercised by one?
