---
trigger: always_on
description: Core working rules for this repository
---

# Core rules

1. `MASTER_PROMPT.md` is the requirements source of truth; `AGENTS.md` is the index. If a request conflicts with them, say so and ask.
2. Plan before coding: for any change touching more than 2 files, produce an implementation plan artifact first (files, schema changes, tests) and wait for approval when it changes the DB schema, auth, payments or permissions.
3. Priority order: Security → Data integrity → Performance → Functionality → Design → Maintainability.
4. Verify facts about libraries, versions and service limits against current docs (Context7 / official docs). Do not rely on memory for config keys or APIs that change between versions.
5. Every task ends with: typecheck, lint, tests green; a short walkthrough of what changed; `docs/CHANGELOG.md` updated.
6. Do not invent business rules. Unknowns go into `docs/OPEN_QUESTIONS.md` and are surfaced to the user.
7. Never generate fake data to make a screen "look done". Seed data must be clearly labelled and removable.
8. Australian context: AUD, `en-AU` formatting, store timezone (default `Australia/Sydney`, DST-aware), GST-inclusive prices, ABN on tax invoices.
