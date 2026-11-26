---
description: Run the security checklist on the current diff or a named module
---

1. Determine scope: current branch diff vs `main`, or the module the user names.
2. Apply `.agents/skills/security-review/SKILL.md` item by item.
3. For every access-control item, write or point to a test proving it.
4. Output a report artifact (PASS / FIX with file:line / N/A). Fix FIX items if asked, then re-run.
