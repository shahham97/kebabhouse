---
description: Run and report the mandatory business scenarios (MASTER_PROMPT §18)
---

1. Read `.agents/skills/testing/SKILL.md`.
2. Run `pnpm test -t "S[0-9]+"` and `pnpm test:e2e`.
3. Produce a table: scenario number, name, unit/integration/E2E status, notes. Missing scenarios are failures.
4. For E2E failures attach Playwright traces/screenshots to the walkthrough.
