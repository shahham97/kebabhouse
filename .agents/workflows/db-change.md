---
description: Make a safe database schema change on TiDB with Prisma
---

1. Read `.agents/rules/30-database-tidb.md`.
2. Edit `prisma/schema.prisma`. For renames/drops use expand → backfill → contract across releases.
3. Add indexes for new FKs and for every new filter/sort used by a query.
4. `pnpm prisma migrate dev --name <change>` using `DIRECT_DATABASE_URL`. Review the generated SQL file; explain it in the walkthrough.
5. Update `docs/ERD.md` (Mermaid) and `docs/DECISIONS.md` if a design choice was made.
6. Update seed and factories; run integration tests.
7. Never edit an applied migration; never use `db push` against shared environments.
