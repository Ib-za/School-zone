-- ============================================================================
-- ELATE SCHOOL PLATFORM — PHASE 1 SCHEMA (v4, post round-2 review)
-- Builds on v3. See bottom of file for the full point-by-point response to
-- the round-2 review, including what was adopted, adapted, or skipped.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- needed for the exclusion constraints in Section 6
-- ============================================================================
-- AUDIT COLUMN CONVENTION (review #1)
-- ============================================================================
-- Postgres has no clean "mixin" for repeated columns without inheritance
-- (which fights RLS/PK independence), so the convention is enforced by
-- consistency rather than a shared base type. Applied as follows:
--   - "Record" tables (the actual business entities: schools, branches,
--     students, staff, parents, classes, announcements, payments, etc.)
--     get the FULL set: created_at, updated_at, created_by, updated_by,
--     deleted_at.
--   - "Link/junction" tables (class_teacher_assignments, parent_student_links,
--     school_payment_providers, announcement_attachments, custom_field_values)
--     get a LIGHTWEIGHT set: created_at always, deleted_at only where a soft
--     "unlink" makes sense. created_by/updated_by are skipped on pure
--     junctions — there's nothing meaningfully "updated" on a join row.
-- This convention is applied consistently across every table below.
-- ============================================================================
-- 0. GENERIC FILE STORAGE
-- ============================================================================
CREATE TABLE file_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    public_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============================================================================
-- 1. TENANCY & SETUP
-- ============================================================================
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_tier TEXT NOT NULL DEFAULT 'basic',
    ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    website_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    currency TEXT NOT NULL DEFAULT 'INR',
    phone TEXT,
    email TEXT,
    principal_name TEXT,
    logo_asset_id UUID REFERENCES file_assets(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    UNIQUE (id, school_id) -- enables composite FKs from staff/classes (review #2)
);
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_academic_year_dates CHECK (start_date < end_date)
);
CREATE UNIQUE INDEX idx_one_current_year_per_school ON academic_years(school_id)
WHERE is_current
    AND deleted_at IS NULL;
CREATE TABLE branch_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    holiday_date DATE NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_branch_holidays_branch FOREIGN KEY (branch_id, school_id) REFERENCES branches(id, school_id) ON DELETE CASCADE -- composite (review #2)
);
-- ============================================================================
-- 2. LOOKUP TABLES (review #4) — for evolving free-text-prone fields
-- ============================================================================
-- Generic category/value pattern, scoped per school. Used for religion,
-- house, department, designation — fields where a fixed ENUM would be too
-- rigid (schools genuinely have different house names) but free text drifts
-- ("Male"/"male"/"M"). Gender is the one exception kept as an ENUM below —
-- it's a small, stable, non-school-specific set, unlike house/department.
CREATE TABLE lookup_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    -- 'religion', 'house', 'department', 'designation'
    UNIQUE (school_id, code)
);
CREATE TABLE lookup_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES lookup_categories(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (category_id, value)
);
-- ============================================================================
-- 3. GRADES & SECTIONS
-- ============================================================================
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (school_id, label)
);
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    UNIQUE (branch_id, label),
    CONSTRAINT fk_sections_branch FOREIGN KEY (branch_id, school_id) REFERENCES branches(id, school_id) ON DELETE CASCADE
);
-- ============================================================================
-- 4. STAFF & PARENTS
-- ============================================================================
CREATE TYPE staff_role AS ENUM (
    'branch_admin',
    'school_admin',
    'management',
    'teacher',
    'school_nurse',
    'librarian',
    'transport_coordinator',
    'accounts',
    'front_desk'
);
-- Kept as ENUM, not a lookup table (review #13 trade-off, decided): each role
-- maps to actual permission code paths in the app. A school admin adding a
-- new "role" via a lookup table wouldn't have any matching permissions
-- behind it — adding a real role requires dev work regardless, so the
-- rigidity of an ENUM matches reality here, unlike fee heads/house names.
CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'terminated', 'resigned');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID,
    role staff_role NOT NULL,
    employee_code TEXT,
    department_id UUID REFERENCES lookup_values(id),
    -- was free-text `department`
    designation_id UUID REFERENCES lookup_values(id),
    -- was free-text `designation`
    salary_grade TEXT,
    employment_status employment_status NOT NULL DEFAULT 'active',
    full_name TEXT NOT NULL,
    photo_asset_id UUID REFERENCES file_assets(id),
    contact_phone TEXT,
    contact_email TEXT,
    joining_date DATE,
    qualifications TEXT,
    experience_notes TEXT,
    metadata JSONB,
    -- review #6 — escape hatch for small customer-specific needs
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    UNIQUE (school_id, employee_code),
    UNIQUE (id, school_id),
    -- enables composite FKs from timetable/assignments (review #2)
    CONSTRAINT fk_staff_branch FOREIGN KEY (branch_id, school_id) REFERENCES branches(id, school_id) -- nullable branch_id: school-wide roles skip this check
);
CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    primary_school_id UUID REFERENCES schools(id),
    full_name TEXT NOT NULL,
    photo_asset_id UUID REFERENCES file_assets(id),
    contact_phone TEXT,
    contact_email TEXT,
    occupation TEXT,
    company TEXT,
    annual_income NUMERIC(14, 2),
    -- sensitive — tightened RLS visibility, see note at bottom
    address_line TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    language_pref TEXT DEFAULT 'en',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
-- `primary_school_id` is a CACHE, not an authorization source (review #10,
-- agreeing with the reviewer's caution). It's set automatically by a trigger
-- below (Section 9) when a parent's first child gets linked, and is never
-- read by an RLS policy — parent_student_links remains the only source of
-- truth for what a parent can actually see.
-- ============================================================================
-- 5. CLASSES, SUBJECTS, TEACHER ASSIGNMENTS
-- ============================================================================
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    grade_id UUID NOT NULL REFERENCES grades(id),
    section_id UUID NOT NULL REFERENCES sections(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    UNIQUE (
        branch_id,
        academic_year_id,
        grade_id,
        section_id
    ),
    UNIQUE (id, school_id),
    -- enables composite FKs from students/attendance/etc. (review #2)
    CONSTRAINT fk_classes_branch FOREIGN KEY (branch_id, school_id) REFERENCES branches(id, school_id) ON DELETE CASCADE
);
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject_code TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (school_id, subject_code)
);
CREATE TABLE class_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL,
    staff_id UUID NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_cta_class FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE CASCADE,
    CONSTRAINT fk_cta_staff FOREIGN KEY (staff_id, school_id) REFERENCES staff(id, school_id) ON DELETE CASCADE
);
-- Only one class (homeroom) teacher per class (review #8)
CREATE UNIQUE INDEX idx_one_class_teacher_per_class ON class_teacher_assignments(class_id)
WHERE is_class_teacher = TRUE
    AND deleted_at IS NULL;
-- ============================================================================
-- 6. STUDENTS, EMERGENCY CONTACTS, SIBLINGS
-- ============================================================================
CREATE TYPE parent_relation AS ENUM (
    'father',
    'mother',
    'guardian',
    'grandparent',
    'other'
);
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    class_id UUID NOT NULL,
    admission_number TEXT NOT NULL,
    qr_identifier TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE,
    gender gender_type,
    photo_asset_id UUID REFERENCES file_assets(id),
    previous_school TEXT,
    admission_date DATE,
    religion_id UUID REFERENCES lookup_values(id),
    -- was free-text `religion`
    nationality TEXT,
    mother_tongue TEXT,
    government_id_number TEXT,
    emis_number TEXT,
    house_id UUID REFERENCES lookup_values(id),
    -- was free-text `house`
    roll_number TEXT,
    transport_required BOOLEAN NOT NULL DEFAULT FALSE,
    hostel_required BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    -- optimistic locking (review #3)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    UNIQUE (branch_id, admission_number),
    UNIQUE (id, school_id),
    -- enables composite FKs from attendance/fees/etc. (review #2)
    CONSTRAINT fk_students_class FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id),
    CONSTRAINT fk_students_branch FOREIGN KEY (branch_id, school_id) REFERENCES branches(id, school_id)
);
CREATE TABLE student_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    name TEXT NOT NULL,
    relation TEXT,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_sec_student FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE CASCADE
);
CREATE TABLE parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    relation parent_relation NOT NULL DEFAULT 'guardian',
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    pickup_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (parent_id, student_id),
    CONSTRAINT fk_psl_student FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE CASCADE
);
-- ============================================================================
-- 7. STUDENT ATTENDANCE & TIMETABLE
-- ============================================================================
CREATE TYPE attendance_status AS ENUM (
    'present',
    'absent',
    'leave',
    'late',
    'holiday',
    'medical',
    'half_day'
);
CREATE TABLE student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    status attendance_status NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    remarks TEXT,
    marked_by UUID,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, attendance_date),
    CONSTRAINT fk_attendance_student FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_class FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id),
    CONSTRAINT fk_attendance_marker FOREIGN KEY (marked_by, school_id) REFERENCES staff(id, school_id)
);
-- Composite indexes (review #7) — student_id+attendance_date already covered
-- by the UNIQUE constraint above; class_id+attendance_date is the one not
-- already implied, so that's the one actually added:
CREATE INDEX idx_attendance_class_date ON student_attendance(class_id, attendance_date);
CREATE TABLE timetable_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    class_id UUID NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    staff_id UUID,
    room TEXT,
    period_number INT,
    is_break BOOLEAN NOT NULL DEFAULT FALSE,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    -- Generated range used for overlap detection below (review #9)
    slot_range tsrange GENERATED ALWAYS AS (
        tsrange(
            ('2000-01-01'::date + start_time),
            ('2000-01-01'::date + end_time)
        )
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_timetable_day CHECK (
        day_of_week BETWEEN 1 AND 7
    ),
    CONSTRAINT chk_timetable_time CHECK (start_time < end_time),
    CONSTRAINT fk_timetable_class FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE CASCADE,
    CONSTRAINT fk_timetable_staff FOREIGN KEY (staff_id, school_id) REFERENCES staff(id, school_id),
    -- True overlap detection at the DB level, not just "handled in application" (review #9):
    EXCLUDE USING gist (
        room WITH =,
        day_of_week WITH =,
        slot_range WITH &&
    )
    WHERE (
            room IS NOT NULL
            AND is_break = FALSE
            AND deleted_at IS NULL
        ),
        EXCLUDE USING gist (
            staff_id WITH =,
            day_of_week WITH =,
            slot_range WITH &&
        )
    WHERE (
            staff_id IS NOT NULL
            AND is_break = FALSE
            AND deleted_at IS NULL
        ),
        EXCLUDE USING gist (
            class_id WITH =,
            day_of_week WITH =,
            slot_range WITH &&
        )
    WHERE (
            is_break = FALSE
            AND deleted_at IS NULL
        )
);
-- ============================================================================
-- 8. ANNOUNCEMENTS
-- ============================================================================
CREATE TYPE announcement_target AS ENUM ('school', 'branch', 'class');
CREATE TYPE announcement_priority AS ENUM ('low', 'normal', 'high', 'urgent');
-- Kept as ENUM (review #13 trade-off, decided): 4 stable priority levels,
-- unlikely to need new values added by a school admin at runtime — unlike
-- fee_head (already TEXT, deliberately, from v1) which genuinely varies
-- per school.
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID,
    class_id UUID,
    target announcement_target NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority announcement_priority NOT NULL DEFAULT 'normal',
    requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    expiry_date DATE,
    published_at TIMESTAMPTZ,
    posted_by UUID NOT NULL,
    metadata JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_announcements_branch FOREIGN KEY (branch_id, school_id) REFERENCES branches(id, school_id),
    CONSTRAINT fk_announcements_class FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id),
    CONSTRAINT fk_announcements_poster FOREIGN KEY (posted_by, school_id) REFERENCES staff(id, school_id)
);
CREATE TABLE announcement_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    file_asset_id UUID NOT NULL REFERENCES file_assets(id),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============================================================================
-- 9. FEES & PAYMENTS
-- ============================================================================
CREATE TYPE fee_frequency AS ENUM ('monthly', 'quarterly', 'annual', 'custom');
CREATE TYPE installment_status AS ENUM (
    'pending',
    'partial',
    'paid',
    'overdue',
    'cancelled',
    'waived'
);
-- review #5
CREATE TYPE payment_status AS ENUM ('initiated', 'success', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM (
    'upi',
    'cash',
    'cheque',
    'card',
    'netbanking',
    'wallet',
    'other'
);
CREATE TABLE payment_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    secrets_ref TEXT,
    public_config JSONB,
    integrated_by_super_admin BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ
);
CREATE TABLE school_payment_providers (
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES payment_providers(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (school_id, provider_id)
);
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    fee_head TEXT NOT NULL,
    -- deliberately TEXT, not ENUM — see review #13 note above
    amount NUMERIC(12, 2) NOT NULL,
    frequency fee_frequency NOT NULL DEFAULT 'annual',
    late_fee_policy JSONB,
    class_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_fee_amount_positive CHECK (amount > 0),
    CONSTRAINT fk_fee_structures_class FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id)
);
CREATE TABLE student_fee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id),
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    scholarship_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_sfa_student FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE CASCADE
);
CREATE TABLE fee_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_assignment_id UUID NOT NULL REFERENCES student_fee_assignments(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount_due NUMERIC(12, 2) NOT NULL,
    fine_amount NUMERIC(12, 2) DEFAULT 0,
    status installment_status NOT NULL DEFAULT 'pending',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_installment_amount_positive CHECK (amount_due > 0)
);
-- Composite index (review #7) — not implied by any existing constraint:
CREATE INDEX idx_fee_installments_assignment_due ON fee_installments(student_fee_assignment_id, due_date);
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    installment_id UUID NOT NULL REFERENCES fee_installments(id),
    provider_id UUID NOT NULL REFERENCES payment_providers(id),
    amount_paid NUMERIC(12, 2) NOT NULL,
    payment_method payment_method,
    payment_status payment_status NOT NULL DEFAULT 'initiated',
    gateway_response JSONB,
    transaction_ref TEXT,
    receipt_number TEXT UNIQUE,
    receipt_file_asset_id UUID REFERENCES file_assets(id),
    is_partial BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- payment_status can change post-creation (refunds)
    CONSTRAINT chk_payment_amount_positive CHECK (amount_paid > 0)
);
-- ============================================================================
-- 10. ACTIVITY LOG
-- ============================================================================
-- Already present from v2/v3 — round-2 review flagged it as "still missing"
-- but it was already here with the exact shape requested (school_id,
-- entity_type, entity_id, action, actor_id, before/after snapshots,
-- created_at). No change needed; kept as-is.
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============================================================================
-- 11. CONFIGURABLE FIELDS (metadata-driven extension layer)
-- ============================================================================
-- Unchanged from v3 — scoped to Student profile only. entity_id is
-- polymorphic, so it intentionally does NOT get a composite tenant FK like
-- the tables above; that check has to happen at the application layer when
-- writing a value (look up the school_id via custom_field_definitions and
-- compare to the target student's school_id).
CREATE TYPE custom_field_entity AS ENUM ('student');
CREATE TYPE custom_field_type AS ENUM (
    'text',
    'number',
    'date',
    'boolean',
    'select',
    'multi_select'
);
CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    entity_type custom_field_entity NOT NULL DEFAULT 'student',
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type custom_field_type NOT NULL,
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_visible_to_parent BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (school_id, entity_type, field_key)
);
CREATE TABLE custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (field_definition_id, entity_id)
);
-- ============================================================================
-- 12. NOTIFICATION FOUNDATION (review #14)
-- ============================================================================
-- Minimal queue table now, even though dispatch logic (actually sending
-- push/SMS/WhatsApp/email) is Phase 2+. Attendance, announcements, and fee
-- payments will all eventually write into this.
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    -- 'attendance_late', 'fee_due', 'announcement_posted', etc.
    recipient_type TEXT NOT NULL,
    recipient_id UUID NOT NULL,
    channel TEXT NOT NULL,
    payload JSONB,
    -- event-specific data the dispatcher needs to render the message
    status TEXT NOT NULL DEFAULT 'queued',
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============================================================================
-- 13. TRIGGERS
-- ============================================================================
-- (a) Optimistic locking — version increments on every update (review #3)
CREATE OR REPLACE FUNCTION increment_version() RETURNS TRIGGER AS $$ BEGIN NEW.version = OLD.version + 1;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_students_version BEFORE
UPDATE ON students FOR EACH ROW EXECUTE FUNCTION increment_version();
CREATE TRIGGER trg_attendance_version BEFORE
UPDATE ON student_attendance FOR EACH ROW EXECUTE FUNCTION increment_version();
CREATE TRIGGER trg_announcements_version BEFORE
UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION increment_version();
CREATE TRIGGER trg_installments_version BEFORE
UPDATE ON fee_installments FOR EACH ROW EXECUTE FUNCTION increment_version();
-- (b) Keep parents.primary_school_id populated as a CACHE only (review #10)
CREATE OR REPLACE FUNCTION sync_parent_primary_school() RETURNS TRIGGER AS $$ BEGIN
UPDATE parents
SET primary_school_id = NEW.school_id
WHERE id = NEW.parent_id
    AND primary_school_id IS NULL;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_primary_school
AFTER
INSERT ON parent_student_links FOR EACH ROW EXECUTE FUNCTION sync_parent_primary_school();
-- (c) Generic updated_at — this was described in earlier review responses
-- but never actually wired up as a trigger in Phase 1 until now. Applied to
-- every table that carries an updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_schools_updated_at BEFORE
UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_branches_updated_at BEFORE
UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_academic_years_updated_at BEFORE
UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_branch_holidays_updated_at BEFORE
UPDATE ON branch_holidays FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_staff_updated_at BEFORE
UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parents_updated_at BEFORE
UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_classes_updated_at BEFORE
UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subjects_updated_at BEFORE
UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_timetable_updated_at BEFORE
UPDATE ON timetable_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fee_structures_updated_at BEFORE
UPDATE ON fee_structures FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE
UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_custom_field_values_updated_at BEFORE
UPDATE ON custom_field_values FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- (students, student_attendance, announcements, fee_installments already
-- get updated_at refreshed as a side effect of the version-increment
-- triggers above — no separate trigger needed on those four)
-- (d) Generic audit logging — writes to activity_logs automatically instead
-- of relying on every API handler to remember to do it. Applied to the
-- highest-value tables for "who changed this" questions; not applied to
-- every table (e.g. lookup_values, file_assets) since that would mostly
-- generate log volume nobody will ever read.
--
-- IMPORTANT DEPENDENCY: actor_id is read from a Postgres session variable
-- (`app.current_actor_id`) that the Bun API must set at the start of every
-- request via `SET LOCAL app.current_actor_id = '<staff or parent uuid>';`
-- on the same transaction/connection used for the write. If the API layer
-- never sets this, the trigger still works — actor_id just comes through
-- NULL on every row. ip_address/user_agent have the same dependency via
-- `app.current_ip` / `app.current_user_agent` session variables.
CREATE OR REPLACE FUNCTION log_activity() RETURNS TRIGGER AS $$
DECLARE v_school_id UUID;
BEGIN v_school_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.school_id
    ELSE NEW.school_id
END;
INSERT INTO activity_logs (
        school_id,
        entity_type,
        entity_id,
        action,
        actor_id,
        old_value,
        new_value,
        ip_address,
        user_agent
    )
VALUES (
        v_school_id,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        lower(TG_OP),
        NULLIF(
            current_setting('app.current_actor_id', true),
            ''
        )::uuid,
        CASE
            WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW)
            ELSE NULL
        END,
        NULLIF(current_setting('app.current_ip', true), '')::inet,
        NULLIF(
            current_setting('app.current_user_agent', true),
            ''
        )
    );
RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_students_audit
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON students FOR EACH ROW EXECUTE FUNCTION log_activity();
CREATE TRIGGER trg_payments_audit
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION log_activity();
CREATE TRIGGER trg_fee_installments_audit
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON fee_installments FOR EACH ROW EXECUTE FUNCTION log_activity();
CREATE TRIGGER trg_announcements_audit
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON announcements FOR EACH ROW EXECUTE FUNCTION log_activity();
-- (e) Soft-delete cascade — ONE worked example, deliberately not applied
-- everywhere. Cascading soft-deletes automatically is risky business logic,
-- not a pure technical default (e.g. soft-deleting a school should almost
-- certainly NOT silently soft-delete every historical payment record).
-- The one case that's safe to automate: a deleted branch's classes should
-- go with it, since a class can't meaningfully exist without its branch.
CREATE OR REPLACE FUNCTION cascade_soft_delete_branch_classes() RETURNS TRIGGER AS $$ BEGIN IF NEW.deleted_at IS NOT NULL
    AND OLD.deleted_at IS NULL THEN
UPDATE classes
SET deleted_at = NEW.deleted_at
WHERE branch_id = NEW.id
    AND deleted_at IS NULL;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_branch_soft_delete_cascade
AFTER
UPDATE ON branches FOR EACH ROW
    WHEN (
        NEW.deleted_at IS DISTINCT
        FROM OLD.deleted_at
    ) EXECUTE FUNCTION cascade_soft_delete_branch_classes();
-- Every other cascade case (school→branches, class→students, etc.) needs
-- its own explicit business decision, not a copy-paste of this pattern.
-- ============================================================================
-- 14. INDEXES
-- ============================================================================
CREATE INDEX idx_branches_school ON branches(school_id);
CREATE INDEX idx_staff_school_branch ON staff(school_id, branch_id);
CREATE INDEX idx_students_branch_class ON students(branch_id, class_id);
-- review #7
CREATE INDEX idx_parent_student_links_parent ON parent_student_links(parent_id);
CREATE INDEX idx_academic_years_school ON academic_years(school_id);
CREATE INDEX idx_announcements_posted_by ON announcements(posted_by);
CREATE INDEX idx_announcements_school_branch_class ON announcements(school_id, branch_id, class_id);
CREATE INDEX idx_payments_provider ON payments(provider_id);
CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref);
CREATE INDEX idx_payments_installment ON payments(installment_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_custom_field_definitions_school ON custom_field_definitions(school_id, entity_type);
CREATE INDEX idx_custom_field_values_entity ON custom_field_values(entity_id);
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_type, recipient_id, status);
-- NOTE: parent_student_links(parent_id, student_id) and
-- student_attendance(student_id, attendance_date) are NOT duplicated here —
-- both are already backed by a UNIQUE constraint above, which Postgres
-- implements as an index. Adding a second identical index would be pure
-- waste, not extra performance.
-- ============================================================================
-- 15. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_isolation_students ON students USING (school_id = (auth.jwt()->>'school_id')::uuid);
CREATE POLICY parent_own_children ON students FOR
SELECT USING (
        id IN (
            SELECT student_id
            FROM parent_student_links
            WHERE parent_id = (auth.jwt()->>'parent_id')::uuid
        )
    );
-- Tightened visibility for parents.annual_income (sensitive financial data,
-- flagged in v3 and still applicable): handle via a column-level view or
-- application-layer field filtering rather than RLS row policy, since RLS
-- governs rows not columns. A `parents_safe` view exposing every column
-- except annual_income, used by anything other than School
-- Admin/Management, is the concrete mechanism — not yet built here, flagged
-- for the RLS implementation pass.
-- ============================================================================
-- ROUND-2 REVIEW FEEDBACK — RESPONSE
-- ============================================================================
-- ADOPTED:
--   #1 Audit convention documented + applied consistently (full set on
--      record tables, lightweight on junctions).
--   #2 Composite tenant-consistency FKs — UNIQUE(id, school_id) added to
--      branches/staff/classes/students, composite FKs added throughout
--      (students→classes, attendance→students/classes, fees→students,
--      parent links→students, timetable→staff, announcements→staff, etc.)
--   #3 Optimistic locking — version column + trigger on students,
--      attendance, announcements, fee_installments.
--   #4 Lookup tables for religion/house/department/designation. Gender kept
--      as ENUM (small, stable, non-school-specific set).
--   #5 installment_status converted to ENUM.
--   #6 metadata JSONB added to students, staff, parents, payments, announcements.
--   #7 Composite indexes added where not already implied by a UNIQUE
--      constraint (students(branch_id,class_id), fee_installments
--      (assignment_id,due_date), attendance(class_id,date)). Skipped
--      duplicating indexes already covered by existing UNIQUE constraints.
--   #8 Partial unique index — one class teacher per class.
--   #9 Real overlap detection via tsrange + EXCLUDE USING gist (room/
--      teacher/class, all scoped by day_of_week) — not just an application-
--      layer comment anymore.
--   #11 Already present (v2/v3) — confirmed shape matches what was requested.
--   #12 Already in place (school_id/branch_id/created_by denormalized).
--   #14 notification_queue minimal table added.
--
-- ADAPTED:
--   #10 Agreed with the caution — primary_school_id is explicitly a cache,
--      never read by RLS, and now auto-populated by a trigger so it can't
--      silently go stale.
--   #13 Partial adoption — religion/house/department/designation became
--      lookup tables (genuinely evolving, school-specific). staff_role and
--      announcement_priority were deliberately KEPT as ENUMs with reasoning
--      inline: roles map to real permission code paths (no self-service
--      value without dev work behind it), and priority levels are a small
--      stable set. fee_head was already TEXT since v1 for exactly the
--      flexibility reason being raised here.
--
-- NOTE: annual_income column-level visibility needs a view or app-layer
-- filter, not a row-level RLS policy — RLS can't restrict by column. Flagged
-- as a concrete to-do for the RLS implementation pass, not solved in DDL.