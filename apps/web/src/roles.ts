import { userRoleSchema, type UserRole } from "@elate/shared";

export const adminRoles = ["platform_admin", "school_admin"] as const satisfies readonly UserRole[];

export function canAccessAdmin(role: unknown) {
  const parsed = userRoleSchema.safeParse(role);
  return parsed.success && adminRoles.includes(parsed.data as (typeof adminRoles)[number]);
}
