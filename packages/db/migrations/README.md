# Migrations

Use idempotent SQL where feasible and wrap multi-statement migrations in `BEGIN; ... COMMIT;`.

For production index work, prefer `CREATE INDEX CONCURRENTLY` in a standalone migration and document locking implications.
