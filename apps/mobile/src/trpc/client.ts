import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@elate/api";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/trpc"
    })
  ]
});
