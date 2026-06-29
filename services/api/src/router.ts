import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { paginationInputSchema, tenantScopedInputSchema } from "@elate/shared";
import type { ApiContext } from "./context";

const t = initTRPC.context<ApiContext>().create();

export const appRouter = t.router({
  health: t.procedure.query(() => ({
    status: "ok" as const,
    at: new Date().toISOString()
  })),
  tenantPreview: t.procedure
    .input(tenantScopedInputSchema.extend({ pagination: paginationInputSchema.optional() }))
    .query(({ input }) => ({
      schoolId: input.schoolId,
      branchId: input.branchId ?? null,
      limit: input.pagination?.limit ?? 25
    })),
  echo: t.procedure.input(z.object({ message: z.string().min(1) })).mutation(({ input }) => input)
});

export type AppRouter = typeof appRouter;
