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

## Roles & Super Admin Onboarding

Role handling uses two layers:

1. **Trusted Auth claims** live in `auth.users.raw_app_meta_data`.
2. **School-domain profiles** live in public tables such as `staff` and `parents`.

`platform_admin` is the Super Admin role. It is intentionally an Auth-only platform claim, not a `staff.role`, because it is not scoped to one school. School-scoped users get both Auth metadata and a public profile row.

### First Platform Admin

Create or choose a Supabase Auth user, then set their app metadata in the Supabase Dashboard:

1. Go to **Authentication → Users**.
2. Open the user.
3. Edit **Raw app metadata**.
4. Set:

```json
{
  "role": "platform_admin"
}
```

Sign out and sign back in after changing app metadata so Supabase issues a fresh JWT.

For local/dev only, the equivalent SQL is:

```sql
-- High-risk: dev/admin use only. This edits trusted Auth metadata.
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"platform_admin"'::jsonb
)
WHERE email = 'email';
```

### Required API Environment

Super Admin onboarding must run through the Bun API with a Supabase backend admin key. Use a Supabase secret key (`sb_secret_...`). Never expose this key in frontend code.

Set these values in the root `.env`:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

### Onboard a School

1. Sign in to the web app as a `platform_admin`.
2. Open `/super-admin/onboarding`.
3. Fill **Create school and first admin**.
4. Submit.

The API creates:

- `schools`
- primary `branches`
- current `academic_years`
- Supabase Auth user if requested
- `staff` row with `role = 'school_admin'`
- Auth `app_metadata` that associates the user to the school, branch, and staff row

The resulting school admin metadata shape is:

```json
{
  "role": "school_admin",
  "school_id": "school-uuid",
  "branch_id": "branch-uuid",
  "staff_id": "staff-uuid"
}
```

### Associate an Existing User

Use `/super-admin/onboarding` → **Associate Auth user to school and branch**.

You need the Supabase Auth user ID from **Authentication → Users**. The form writes or updates the public `staff` row and then updates the user's trusted app metadata:

```json
{
  "role": "branch_admin",
  "school_id": "school-uuid",
  "branch_id": "branch-uuid",
  "staff_id": "staff-uuid"
}
```

Supported school-scoped staff roles for this flow:

- `school_admin`
- `branch_admin`
- `teacher`

Any change to Auth app metadata requires the affected user to sign out and sign back in.

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
