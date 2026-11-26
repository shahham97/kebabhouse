---
description: Pre-deployment gate for preview or production
---

1. Read `.agents/skills/deploy-ops/SKILL.md`.
2. Verify: CI green, `/test-scenarios` all pass, `/security-review` has no FIX items, Lighthouse ≥ 90 on Home/Menu/Product (mobile).
3. Diff env vars needed vs configured (names only, never print values).
4. Confirm migrations are expand-only for this release and run `prisma migrate deploy` via CI before promotion.
5. Production only: walk the go-live checklist and list anything not done. Remind the owner that production must not run on Vercel Hobby (non-commercial).
6. Output a go/no-go report.
