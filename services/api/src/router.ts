import { initTRPC } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  paginationInputSchema,
  superAdminAssociateStaffInputSchema,
  superAdminOnboardSchoolInputSchema,
  tenantScopedInputSchema
} from "@elate/shared";
import type { ApiContext } from "./context";
import { getPhase1AdminSnapshot, getPhase1SystemStatus } from "./services/phase1";
import { associateStaffUser, listOnboardedSchools, onboardSchool } from "./services/super-admin";

const t = initTRPC.context<ApiContext>().create();
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A valid Supabase bearer token is required."
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  const staffRoles = new Set(["platform_admin", "school_admin", "branch_admin", "teacher"]);

  if (!ctx.user.role || !staffRoles.has(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A staff role claim is required for this API route."
    });
  }

  return next({ ctx });
});
const platformAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "platform_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A platform_admin role claim is required for this API route."
    });
  }

  return next({ ctx });
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
