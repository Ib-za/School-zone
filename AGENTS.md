# Repository Agents Guide

This file provides concise guidance for AI coding agents working on this repository. Keep it minimal and link-heavy — do not duplicate larger docs.

**DB Agent**

- **Purpose:** Assist with database design, migrations, RLS policy design, SQL review, indexes, and lightweight query generation for the Elate School Platform.
- **Primary targets:** schema review, RLS policy suggestions, migration SQL, perf recommendations, sample queries, and data-model explanations.
- **Key facts:**
  - Tech stack: Bun API (tRPC), Supabase Postgres with `pgvector`. RLS is required on tenant-scoped tables.
  - Schema location: [design-docs/Elate_Database_Schema_v1.sql](design-docs/Elate_Database_Schema_v1.sql)
  - High-level product decisions: [design-docs/handover.md](design-docs/handover.md)
  - Project README: [README.md](README.md)

- **What the DB agent should do (examples):**
  - Propose RLS policies for a given table and tenant model, returning SQL `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` plus `CREATE POLICY` statements.
  - Produce idempotent migration SQL in a single transaction, with `up` and `down` sections where applicable.
  - Explain schema relationships and suggest missing foreign keys or indexes.
  - Audit queries for obvious performance issues and suggest index changes or query rewrites.
  - Generate sample queries for UI use-cases (paginated lists, scoped by school/branch/tenant).

- **Formatting & safety rules:**
  - Always return SQL as a suggested patch (diff) and never make live DB changes.
  - Wrap multi-statement migrations in `BEGIN; ... COMMIT;` and include rollback where feasible.
  - Prefer explicit `CREATE INDEX CONCURRENTLY` guidance for production, and note locking implications.
  - When suggesting RLS policies, include a short explanation of why the policy is safe and how it maps to roles from `design-docs/handover.md`.
  - Tag any suggestions that touch billing, security, or cross-tenant access as high-risk and require human review.

- **How to present deliverables:**
  - Provide SQL in fenced blocks and a short natural-language summary (1–3 lines).
  - When suggesting migrations, include the target file path and a concise commit message/title.
  - Include references to the exact schema lines or table names using file links when possible.

- **Local verification hints:**
  - See [README.md](README.md) for project-level notes. There is no further local DB run script in repo — follow the platform's Supabase/Bun setup if provided elsewhere.

- **When to escalate to humans:**
  - Any change that affects cross-tenant authorization, billing, or legal data retention policies.
  - Complex schema remodels that require data migrations with ETL steps.

If you'd like, I can also add focused prompts/examples for common DB tasks, or create a `db-agent` skill that exposes helper prompts and validation checks.
