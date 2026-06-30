"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@elate/api";
import { createClient as createSupabaseBrowserClient } from "../utils/supabase/client";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/trpc",
      async headers() {
        const supabase = createSupabaseBrowserClient();
        const { data: { session }, } = await supabase.auth.getSession();
        return session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {};
      },
    }),
  ],
});
