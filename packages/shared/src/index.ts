import { z } from "zod";

export const userRoleSchema = z.enum([
  "platform_admin",
  "school_admin",
  "branch_admin",
  "teacher",
  "student",
  "parent"
]);

export const staffPortalRoleSchema = z.enum(["platform_admin", "school_admin", "branch_admin", "teacher"]);
export const schoolStaffRoleSchema = z.enum(["school_admin", "branch_admin", "teacher"]);

export const tenantScopedInputSchema = z.object({
  schoolId: z.uuid(),
  branchId: z.uuid().optional()
});

export const paginationInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25)
});

export const phase1RoleSchema = z.enum(["platform_admin", "school_admin", "branch_admin", "teacher", "parent"]);

export const phase1ModuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  role: phase1RoleSchema,
  status: z.enum(["ready", "scaffolded", "deferred"]),
  description: z.string()
});

export const phase1Modules = [
  {
    id: "super-admin-onboarding",
    label: "School Onboarding",
    role: "platform_admin",
    status: "scaffolded",
    description: "Create a school, primary branch, academic year, and initial school admin."
  },
  {
    id: "school-setup",
    label: "School & Branch Setup",
    role: "school_admin",
    status: "scaffolded",
    description: "Create branches, academic years, holidays, classes, sections, and staff."
  },
  {
    id: "student-setup",
    label: "Student Setup",
    role: "school_admin",
    status: "scaffolded",
    description: "Add students, link parents, assign classes, and render student custom fields."
  },
  {
    id: "attendance-entry",
    label: "Attendance Entry",
    role: "teacher",
    status: "scaffolded",
    description: "Teachers mark daily student attendance for their assigned class."
  },
  {
    id: "timetable",
    label: "Time Table",
    role: "teacher",
    status: "scaffolded",
    description: "Build and view class schedules by day, period, subject, room, and teacher."
  },
  {
    id: "announcements",
    label: "Announcements",
    role: "school_admin",
    status: "scaffolded",
    description: "Publish school, branch, or class targeted notices."
  },
  {
    id: "fees-payments",
    label: "Fees + Pay Now",
    role: "parent",
    status: "scaffolded",
    description: "Show due installments, transaction history, and initiate provider checkout."
  },
  {
    id: "student-profile",
    label: "Student Profile",
    role: "parent",
    status: "scaffolded",
    description: "Parent-visible student profile, including allowed custom fields."
  }
] as const satisfies readonly z.infer<typeof phase1ModuleSchema>[];

export const superAdminOnboardSchoolInputSchema = z
  .object({
    school: z.object({
      name: z.string().trim().min(2),
      subscriptionTier: z.string().trim().min(1).default("basic")
    }),
    branch: z.object({
      name: z.string().trim().min(2),
      address: z.string().trim().optional(),
      timezone: z.string().trim().min(1).default("Asia/Kolkata"),
      currency: z.string().trim().min(3).max(3).default("INR"),
      phone: z.string().trim().optional(),
      email: z.email().optional(),
      principalName: z.string().trim().optional()
    }),
    academicYear: z.object({
      label: z.string().trim().min(2),
      startDate: z.iso.date(),
      endDate: z.iso.date()
    }),
    admin: z.object({
      mode: z.enum(["create", "existing"]),
      authUserId: z.uuid().optional(),
      email: z.email(),
      password: z.string().min(8).optional(),
      fullName: z.string().trim().min(2),
      employeeCode: z.string().trim().optional(),
      contactPhone: z.string().trim().optional()
    })
  })
  .superRefine((input, ctx) => {
    if (input.admin.mode === "create" && !input.admin.password) {
      ctx.addIssue({
        code: "custom",
        path: ["admin", "password"],
        message: "Password is required when creating a new admin user."
      });
    }

    if (input.admin.mode === "existing" && !input.admin.authUserId) {
      ctx.addIssue({
        code: "custom",
        path: ["admin", "authUserId"],
        message: "Auth user ID is required when associating an existing user."
      });
    }

    if (input.academicYear.startDate >= input.academicYear.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["academicYear", "endDate"],
        message: "Academic year end date must be after the start date."
      });
    }
  });

export const superAdminAssociateStaffInputSchema = z.object({
  authUserId: z.uuid(),
  schoolId: z.uuid(),
  branchId: z.uuid(),
  role: schoolStaffRoleSchema,
  email: z.email().optional(),
  fullName: z.string().trim().min(2),
  employeeCode: z.string().trim().optional(),
  contactPhone: z.string().trim().optional()
});

export const phase1TableNames = [
  "schools",
  "branches",
  "academic_years",
  "grades",
  "sections",
  "classes",
  "staff",
  "parents",
  "students",
  "parent_student_links",
  "student_attendance",
  "timetable_slots",
  "announcements",
  "fee_structures",
  "student_fee_assignments",
  "fee_installments",
  "payments",
  "custom_field_definitions",
  "custom_field_values"
] as const;

export type UserRole = z.infer<typeof userRoleSchema>;
export type StaffPortalRole = z.infer<typeof staffPortalRoleSchema>;
export type SchoolStaffRole = z.infer<typeof schoolStaffRoleSchema>;
export type TenantScopedInput = z.infer<typeof tenantScopedInputSchema>;
export type PaginationInput = z.infer<typeof paginationInputSchema>;
export type Phase1Role = z.infer<typeof phase1RoleSchema>;
export type Phase1Module = z.infer<typeof phase1ModuleSchema>;
export type Phase1TableName = (typeof phase1TableNames)[number];
export type SuperAdminOnboardSchoolInput = z.infer<typeof superAdminOnboardSchoolInputSchema>;
export type SuperAdminAssociateStaffInput = z.infer<typeof superAdminAssociateStaffInputSchema>;
