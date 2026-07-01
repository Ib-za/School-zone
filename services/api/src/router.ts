import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
  createAcademicYearInputSchema,
  createBranchInputSchema,
  createClassInputSchema,
  createStaffInputSchema,
  createStudentInputSchema,
  createGradeInputSchema,
  createSectionInputSchema,
  createSubjectInputSchema,
  paginationInputSchema,
  superAdminAssociateStaffInputSchema,
  superAdminOnboardSchoolInputSchema,
  tenantScopedInputSchema
} from "@elate/shared";
import { requirePlatformAdmin, requireSchoolAdmin, requireSchoolOrBranchAdmin, requireSchoolStaff, requireUser } from "./authz";
import type { ApiContext } from "./context";
import { getPhase1AdminSnapshot, getPhase1SystemStatus } from "./services/phase1";
import {
  createAcademicYear,
  createBranch,
  createClass,
  createGrade,
  createSection,
  createSubject,
  getSetupSnapshot
} from "./services/setup";
import { createStaff, listStaff } from "./services/staff";
import { createStudent, listStudents } from "./services/students";
import { associateStaffUser, listOnboardedSchools, onboardSchool } from "./services/super-admin";

const t = initTRPC.context<ApiContext>().create();
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  const user = requireUser(ctx);

  return next({
    ctx: {
      ...ctx,
      user
    }
  });
});
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  return next({ ctx: { ...ctx, staff: requireSchoolStaff(ctx) } });
});
const schoolAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  return next({ ctx: { ...ctx, staff: requireSchoolAdmin(ctx) } });
});
const schoolOrBranchAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  return next({ ctx: { ...ctx, staff: requireSchoolOrBranchAdmin(ctx) } });
});
const platformAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  return next({ ctx: { ...ctx, platformAdmin: requirePlatformAdmin(ctx) } });
});

export const appRouter = t.router({
  health: publicProcedure.query(async () => ({
    status: "ok" as const,
    at: new Date().toISOString(),
    phase1: await getPhase1SystemStatus()
  })),
  phase1: t.router({
    status: publicProcedure.query(() => getPhase1SystemStatus()),
    me: protectedProcedure.query(({ ctx }) => ({
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role
    })),
    adminSnapshot: staffProcedure.query(({ ctx }) => getPhase1AdminSnapshot(ctx.accessToken)),
    parentHome: protectedProcedure
      .input(z.object({ parentId: z.uuid().optional() }).optional())
      .query(({ ctx, input }) => ({
        parentId: input?.parentId ?? null,
        userId: ctx.user.id,
        items: [
          "select-child",
          "student-profile",
          "attendance",
          "timetable",
          "announcements",
          "fees-pay-now"
        ]
      })),
    paymentCheckout: protectedProcedure
      .input(z.object({ installmentId: z.uuid(), providerId: z.uuid() }))
      .mutation(({ input }) => ({
        status: "not_integrated_yet" as const,
        installmentId: input.installmentId,
        providerId: input.providerId
      }))
  }),
  superAdmin: t.router({
    schools: platformAdminProcedure.query(() => listOnboardedSchools()),
    onboardSchool: platformAdminProcedure
      .input(superAdminOnboardSchoolInputSchema)
      .mutation(({ input }) => onboardSchool(input)),
    associateStaffUser: platformAdminProcedure
      .input(superAdminAssociateStaffInputSchema)
      .mutation(({ input }) => associateStaffUser(input))
  }),
  setup: t.router({
    snapshot: staffProcedure.query(({ ctx }) => getSetupSnapshot(ctx.staff)),
    createBranch: schoolAdminProcedure.input(createBranchInputSchema).mutation(({ ctx, input }) => createBranch(ctx.staff, input)),
    createAcademicYear: schoolAdminProcedure
      .input(createAcademicYearInputSchema)
      .mutation(({ ctx, input }) => createAcademicYear(ctx.staff, input)),
    createGrade: schoolAdminProcedure.input(createGradeInputSchema).mutation(({ ctx, input }) => createGrade(ctx.staff, input)),
    createSection: schoolOrBranchAdminProcedure
      .input(createSectionInputSchema)
      .mutation(({ ctx, input }) => createSection(ctx.staff, input)),
    createSubject: schoolAdminProcedure.input(createSubjectInputSchema).mutation(({ ctx, input }) => createSubject(ctx.staff, input)),
    createClass: schoolOrBranchAdminProcedure
      .input(createClassInputSchema)
      .mutation(({ ctx, input }) => createClass(ctx.staff, input))
  }),
  staff: t.router({
    list: staffProcedure.query(({ ctx }) => listStaff(ctx.staff)),
    create: schoolAdminProcedure.input(createStaffInputSchema).mutation(({ ctx, input }) => createStaff(ctx.staff, input))
  }),
  students: t.router({
    list: staffProcedure.query(({ ctx }) => listStudents(ctx.staff)),
    create: schoolOrBranchAdminProcedure.input(createStudentInputSchema).mutation(({ ctx, input }) => createStudent(ctx.staff, input))
  }),
  tenantPreview: staffProcedure
    .input(tenantScopedInputSchema.extend({ pagination: paginationInputSchema.optional() }))
    .query(({ input }) => ({
      schoolId: input.schoolId,
      branchId: input.branchId ?? null,
      limit: input.pagination?.limit ?? 25
    })),
  echo: protectedProcedure.input(z.object({ message: z.string().min(1) })).mutation(({ input }) => input)
});

export type AppRouter = typeof appRouter;
