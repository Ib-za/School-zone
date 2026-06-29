import { z } from "zod";

export const userRoleSchema = z.enum([
  "platform_admin",
  "school_admin",
  "branch_admin",
  "teacher",
  "student",
  "parent"
]);

export const tenantScopedInputSchema = z.object({
  schoolId: z.uuid(),
  branchId: z.uuid().optional()
});

export const paginationInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25)
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type TenantScopedInput = z.infer<typeof tenantScopedInputSchema>;
export type PaginationInput = z.infer<typeof paginationInputSchema>;
