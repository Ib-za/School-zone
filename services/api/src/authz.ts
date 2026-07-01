import { TRPCError } from "@trpc/server";
import type { ApiContext } from "./context";
import type { VerifiedApiUser } from "./supabase";

export type SchoolScopedStaffUser = VerifiedApiUser & {
  role: "school_admin" | "branch_admin" | "teacher";
  schoolId: string;
  branchId: string | null;
  staffId: string;
};

export function requireUser(ctx: ApiContext) {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A valid Supabase bearer token is required."
    });
  }

  return ctx.user;
}

export function requirePlatformAdmin(ctx: ApiContext) {
  const user = requireUser(ctx);

  if (user.role !== "platform_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A platform_admin role claim is required for this API route."
    });
  }

  return user;
}

export function requireSchoolStaff(ctx: ApiContext): SchoolScopedStaffUser {
  const user = requireUser(ctx);

  if (!["school_admin", "branch_admin", "teacher"].includes(user.role ?? "")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A school staff role claim is required for this API route."
    });
  }

  if (!user.schoolId || !user.staffId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The authenticated staff user is missing school_id or staff_id claims."
    });
  }

  return user as SchoolScopedStaffUser;
}

export function requireSchoolAdmin(ctx: ApiContext) {
  const user = requireSchoolStaff(ctx);

  if (user.role !== "school_admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A school_admin role claim is required for this API route."
    });
  }

  return user;
}

export function requireSchoolOrBranchAdmin(ctx: ApiContext) {
  const user = requireSchoolStaff(ctx);

  if (!["school_admin", "branch_admin"].includes(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A school_admin or branch_admin role claim is required for this API route."
    });
  }

  return user;
}

export function assertBranchAccess(user: SchoolScopedStaffUser, branchId: string) {
  if (user.role === "branch_admin" && user.branchId !== branchId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Branch admins can only access their assigned branch."
    });
  }
}
