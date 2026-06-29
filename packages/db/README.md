# @elate/db

Postgres schema, pgvector migrations, and RLS policy drafts live here.

- Source schema reference: `../../design-docs/Elate_Database_Schema_v1.sql`
- Place migrations under `migrations/`.
- Place RLS policy drafts under `rls/`.

High-risk changes touching billing, security, or cross-tenant access require human review before deployment.
