# Elate — Phase 1 Kickstart Plan (Full Scope, Not Just DB)

Expands the one-line Phase 1 entry from the feature spec ("Auth, School/Branch/Academic Year setup, Student profile, Attendance, Announcements, Time Table, Fees + Pay Now, basic Admin Portal") into an actual buildable scope across every layer.

Companion to `Elate_Database_Schema_Phase1.sql`.

---

## 1. Objective

Get one school, one branch, live: parents can log in and see their child's attendance, timetable, and pay fees. Admin can set up the school and post announcements. Nothing else. This is deliberately narrow — the point of Phase 1 is to validate the whole stack end-to-end (Expo → tRPC → Bun → Supabase) on the smallest possible feature set before adding breadth.

---

## 2. Roles Included in Phase 1

| Role | Capability in Phase 1 |
|---|---|
| **School Admin** | Full access to everything below |
| **Branch Admin** | Same as School Admin, scoped to their branch |
| **Teacher** | Mark attendance for their assigned class, view timetable |
| **Parent** | View-only access to their child's data + pay fees |

**Explicitly not yet active**: Management, School Nurse, Librarian, Transport Coordinator, Accounts, Front Desk — these roles exist conceptually but have nothing to *do* until their corresponding features ship in later phases.

---

## 3. Parent App — Screens & Features

| Screen | What it does |
|---|---|
| Login | Email/password via Supabase Auth |
| Home | Select child (if multiple already linked — see note below) |
| Student Profile (view-only) | Name, class/section, photo |
| Attendance | Monthly view, present/absent/half-day totals |
| Time Table | Class schedule, read-only |
| Announcements | List view, school/branch/class-targeted |
| Fees | Fee details, due breakdown, **Pay Now**, transaction history |

**Not in Phase 1**: Add Siblings flow (parent_student_links table exists in the DB from day one so it's not a retrofit later, but the *UI* to add a sibling is deferred — Phase 1 assumes admin pre-links siblings during setup if needed), Chat, Class Diary, Student Wall, Gallery, Transport, Appointments/PTM, Health Profile, Library, AI features.

---

## 4. School Admin Portal — Screens & Features

| Screen | What it does |
|---|---|
| Login | Role-based (School Admin / Branch Admin / Teacher) |
| School & Branch Setup | Create branch(es), set academic year, add branch holidays |
| Classes & Sections | Create classes, assign a teacher |
| Student Setup | Add student, assign to class, basic profile fields + photo |
| Staff Setup | Add staff (Admin/Teacher), assign role + branch |
| Attendance Entry | Teacher marks daily attendance for their class |
| Time Table Builder | Assign subject + teacher + room + time slot per class |
| Announcements Composer | Post to school / branch / class |
| Fee Setup | Define fee structures (tuition, transport, etc.), assign to students, set installments |
| Payment provider Selection | Pick from Super-Admin-integrated gateways |
| **Custom Fields Manager** | School Admin defines extra fields for the Student profile (label, type, options, required, parent-visible Y/N) — no deploy needed |

**Not in Phase 1**: Chat Oversight, Special Notes, Vendor Marketplace, Library, Transport Management, Website Management, AI Add-on toggle, Management Dashboard, Leave Management, Attendance Calendar (the colored-dot one — that's staff attendance, not student, and staff attendance hardware integration is deferred), Principal-Teacher Meetings.

---

## 5. Super Admin Portal — Minimal Slice

Phase 1 needs just enough Super Admin to make the rest functional:

| Screen | What it does |
|---|---|
| School Onboarding | Create the first school + initial admin user |
| Payment Gateway Integration | Integrate at least one provider (e.g. Razorpay) for School Admin to select |

**Not in Phase 1**: Subscription/Billing dashboard, Cross-School Analytics, Vendor Marketplace approval, Attendance Hardware vendor list, Support Queue, AI/Website Add-on billing.

---

## 6. Architecture Active in Phase 1

| Piece | Phase 1 status |
|---|---|
| Supabase Auth | ✅ Active — login for both apps |
| Supabase Postgres + RLS | ✅ Active — Phase 1 tables only, RLS written for just these 28 (see schema next-steps doc) |
| tRPC (Bun API) | ✅ Active — this is foundational, not phase-gated; build it correctly from the start since retrofitting type-safety later is far more painful than scoping it down now |
| Supabase Storage | ✅ Active, minimally — just student/parent profile photos |
| Cloudflare Images + client-side compression | ⏸️ Defer — profile photos can go straight to Supabase Storage unprocessed for Phase 1; add the compression/CDN pipeline when Gallery/Chat attachments arrive in Phase 2-3, since that's when image volume actually matters |
| Notifications service | ⏸️ Defer — Phase 1 has no chat/late-attendance/fee-due triggers that need it yet |
| pgvector / embeddings | ⏸️ Defer entirely — no AI-enabled content exists in Phase 1 |
| Payment gateway integration | ✅ Active — required for Pay Now |
| Configurable Fields (metadata-driven) | ✅ Active, narrowly scoped — Student profile only (see Section 6a) |

---

## 6a. Configurable Fields — Metadata-Driven Architecture

Added per the schema review feedback, but scoped deliberately small for Phase 1 rather than a full platform-wide rebuild:

- **What it is**: School Admin can define extra fields on the Student profile (text/number/date/boolean/select/multi-select, with options, required flag, and a parent-visibility flag) without any code deploy or migration
- **Why it's narrow**: the fixed columns already on `students` (gender, religion, house, roll number, transport/hostel flags, etc.) cover the near-universal fields every school needs. This layer exists only for the genuinely school-specific extras — one school wants "House Captain Y/N," another wants "Bus Pass Number" — neither of which deserves a permanent column every tenant pays for
- **Two new tables**: `custom_field_definitions` (the school's field schema) and `custom_field_values` (the actual data per student) — see `Elate_Database_Schema_Phase1_v3.sql`
- **New Admin Portal screen**: Custom Fields Manager — define/edit/reorder fields
- **Student Setup screen change**: dynamically renders whatever custom fields exist for that school, alongside the fixed fields, in the same form
- **Parent App**: only shows a custom field if its `is_visible_to_parent` flag is on — most custom fields will be admin-internal and shouldn't surface to parents by default
- **Explicitly not extended to**: Admission forms, Fee structures, or Grading systems in Phase 1 — those modules don't exist yet (Admission Management is a Section 8 / later-phase module; Fee structure already has a fixed shape in Phase 1). The right time to make those configurable is when they're actually being built, not speculatively now. Broader metadata-driven scope (a real workflow/forms engine) is a legitimate future direction but a separate strategic decision, not something to half-build inside Phase 1.

---


## 8. Explicitly Deferred (Full List)

Everything not named above, including but not limited to: Class Diary, Student Wall, Chat (+ attachments), Special Notes, Gallery, Transport (regular + outings), Appointments & PTM, Principal-Teacher Meetings, Student Health Profile, Staff Leave Management, Staff Attendance Calendar/hardware integration, Library, Vendor Marketplace, Website Management, AI features (all of them), Admission Management, board-specific Examination tooling, HR/Payroll beyond nothing (Phase 1 has zero payroll), Accounting, Hostel, full Inventory, Visitor Management, CCTV, E-Signatures, Document Management, Alumni Portal. Also deferred: extending Configurable Fields beyond the Student entity (Staff/Parent custom fields use the identical pattern, just not switched on yet).

---

## 9. Definition of Done for Phase 1

- A School Admin can set up a branch, academic year, classes, students, and staff from scratch with no manual DB intervention
- A Teacher can log in and mark attendance for their class
- A Parent can log in, see their child's attendance/timetable/announcements, and successfully complete a real payment via the integrated gateway
- A School Admin can define a new custom field for Student profiles in the Custom Fields Manager and see it appear in the Student Setup form immediately, with no deploy
- All of the above respects RLS — a second school's data is provably unreachable from the first school's session
