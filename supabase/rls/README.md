# Row Level Security (RLS) Policies

This directory contains RLS policy templates for tenant-scoped tables.

## Overview

Every tenant-scoped table in the Elate platform requires RLS policies to ensure users can only access data for their school/branch.

### Key Principles

- **Tenant Isolation**: Users can only see data for their `school_id`
- **JWT Claims**: Policies filter based on `auth.jwt()` claims
- **Broadcast**: Use `ENABLE ROW LEVEL SECURITY; ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

### Roles

Based on `design-docs/handover.md`:

- **School Admin**: Full access to school-scoped data
- **Branch Admin**: Access to branch-level data + their branch's students/staff
- **Teacher**: Access to their assigned class + timetable + own attendance
- **Parent**: Access to their children's health, attendance, marks
- **School Nurse**: Access to student health profiles (school-wide)
- **Management**: Billing, staff payroll, analytics (school-wide)

## Template Policies

### Pattern 1: School-Scoped (No Branch)

```sql
CREATE POLICY "Users can view their school's X"
  ON table_name
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::uuid);

CREATE POLICY "School admin can update their school's X"
  ON table_name
  FOR UPDATE
  USING (school_id = (auth.jwt() ->> 'school_id')::uuid)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::uuid);
```

### Pattern 2: Branch-Scoped

```sql
CREATE POLICY "Users can view their branch's X"
  ON table_name
  FOR SELECT
  USING (branch_id = (auth.jwt() ->> 'branch_id')::uuid);
```

### Pattern 3: Cross-Role (e.g., Parents Viewing Their Child's Data)

```sql
CREATE POLICY "Parents can view their child's health profile"
  ON student_health_profiles
  FOR SELECT
  USING (
    student_id IN (
      SELECT student_id
      FROM parent_student_links
      WHERE parent_id = (auth.jwt() ->> 'sub')::uuid
    )
  );
```

## Implementation

When creating a new tenant-scoped table:

1. Add `school_id` (and `branch_id` if needed) to the table
2. Create this directory's policy template adapted to the table
3. Run the policy SQL after the table is created
4. Test with different roles to ensure isolation

## Testing Policies

```sql
-- Test as school admin
SELECT auth.jwt();

-- Test with seeded data
INSERT INTO schools (id, name) VALUES ('school-uuid-1', 'Test School');
INSERT INTO staff (id, auth_user_id, school_id, role, full_name)
VALUES ('staff-uuid-1', auth.uid(), 'school-uuid-1', 'school_admin', 'Admin User');

-- Verify only this school's data is visible
SELECT * FROM staff;
```

## Notes

- **Never grant ALL**: Prefer minimal, explicit policies
- **Test before deployment**: Always verify RLS in staging
- **Document assumptions**: Include comments on role assumptions in policies
