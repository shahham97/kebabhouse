---
description: Plan a module before writing code (use at the start of every module)
---

1. Read `MASTER_PROMPT.md` sections for this module, `AGENTS.md`, and the matching skill(s) in `.agents/skills/`.
2. List what already exists in the repo that you will reuse (helpers, components, services). Prefer reuse.
3. Produce an Implementation Plan artifact with:
   - user stories + acceptance criteria (link the §18 scenario numbers)
   - schema changes (Prisma diff) and indexes
   - permissions to add (`config/permissions.ts`) and registry entries (`config/modules.ts`)
   - actions/queries/services/components to create, each with a one-line purpose
   - cache tags affected, realtime channels, notifications
   - tests to write (unit/integration/E2E)
   - estimated new lines of code per file — challenge anything over 250
   - open questions for the owner
4. Stop and wait for approval.
