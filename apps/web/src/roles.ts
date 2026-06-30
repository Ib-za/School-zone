import { userRoleSchema, type UserRole } from "@elate/shared";

export const adminRoles = ["platform_admin", "school_admin"] as const satisfies readonly UserRole[];
export const staffPortalRoles = [
  "platform_admin",
  "school_admin",
  "branch_admin",
  "teacher"
] as const satisfies readonly UserRole[];

export function canAccessAdmin(role: unknown) {
  const parsed = userRoleSchema.safeParse(role);
  return parsed.success && adminRoles.includes(parsed.data as (typeof adminRoles)[number]);
}

export function canAccessStaffPortal(role: unknown) {
  const parsed = userRoleSchema.safeParse(role);
  return parsed.success && staffPortalRoles.includes(parsed.data as (typeof staffPortalRoles)[number]);
}

export function canAccessSuperAdmin(role: unknown) {
  const parsed = userRoleSchema.safeParse(role);
  return parsed.success && parsed.data === "platform_admin";
}
