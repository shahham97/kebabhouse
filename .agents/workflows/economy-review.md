---
description: Review the current diff for unnecessary code, duplication and over-engineering
---

1. Read `.agents/rules/10-code-economy.md`.
2. For each changed file report: lines added, anything duplicating an existing helper/component, any new dependency, any abstraction with a single caller, any custom code a platform feature (Next.js, Prisma, DB constraint, Zod, shadcn) already provides.
3. Propose concrete deletions/replacements with before/after line counts.
4. Apply only after approval; re-run typecheck, lint, tests.
