# Supabase Configuration

This directory contains the Supabase database configuration and migrations for the Elate School Platform.

## Directory Structure

```
supabase/
├── migrations/        # Database migrations (auto-applied by Supabase CLI)
├── config.toml        # Supabase project configuration
└── README.md          # This file
```

## GitHub Integration Setup

To configure Supabase with GitHub Actions for automatic migrations:

### 1. Link Your Repository
- Go to your Supabase project dashboard
- Navigate to **Project Settings → GitHub Connections**
- Connect your GitHub repository
- Set the production branch (typically `main`)

### 2. Configure the Path
- When prompted for the **Supabase path**, use: `./supabase`
- This tells Supabase CLI to look for migrations in `/supabase/migrations/`

### 3. Enable Preview Branches (Optional)
- Set up preview branches for pull requests
- Supabase will automatically create ephemeral databases for testing migrations

## Migration Workflow

### Creating a New Migration

```bash
cd /Users/zameer/Projects/ibza/School-zone

# Generate a new migration file with timestamp
supabase migration new <name>
# Example: supabase migration new add_user_preferences

# Edit the migration file in supabase/migrations/
# Write your SQL changes

# Test locally (if using Supabase CLI locally)
supabase start
supabase db push

# Commit and push to GitHub
git add supabase/
git commit -m "migration: <description>"
git push
```

### Migration Best Practices

1. **Idempotent SQL**: Use `IF NOT EXISTS` / `IF EXISTS` clauses
2. **Transactions**: Wrap multi-statement migrations in `BEGIN; ... COMMIT;`
3. **Rollbacks**: Include rollback logic in comments when complex
4. **Naming**: Use `YYYYMMDDHHMMSS_descriptive_name.sql` format
5. **Comments**: Document why the migration is needed

Example idempotent migration:

```sql
BEGIN;

-- Add new column safely
ALTER TABLE students
ADD COLUMN IF NOT EXISTS guardian_phone TEXT;

-- Create index safely
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone
ON students(guardian_phone);

COMMIT;
```

## Tenant-Scoped Tables & RLS

All tenant-scoped tables require Row Level Security (RLS) policies. See [rls/README.md](../packages/db/rls/) for policy templates.

**Key principles:**
- Every table has `school_id` (and `branch_id` where relevant)
- RLS policies filter rows by `school_id` from JWT claims
- Schema only defines tables; RLS policies are separate

## Verification

After migrations are applied:

```bash
# List all migrations applied
supabase migration list

# Check database status
supabase status
```

## Documentation

- Schema reference: [design-docs/Elate_Database_Schema_v1.sql](../design-docs/Elate_Database_Schema_v1.sql)
- Design decisions: [design-docs/handover.md](../design-docs/handover.md)
- DB agent guide: [AGENTS.md](../AGENTS.md#db-agent)

## Support

For issues or questions:
1. Check Supabase CLI docs: https://supabase.com/docs/guides/cli/
2. Review the schema design docs
3. Consult the DB agent guide in AGENTS.md
