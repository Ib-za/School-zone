import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./context";
import { handleCorsPreflight, withCors } from "./cors";
import { handleRestRequest } from "./rest";
import { appRouter } from "./router";
import { handleWebhookRequest } from "./webhooks";

const port = Number(process.env.PORT ?? 4000);

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleCorsPreflight(request);
    }

    if (url.pathname.startsWith("/trpc")) {
      return withCors(request, await fetchRequestHandler({
        endpoint: "/trpc",
        req: request,
        router: appRouter,
        createContext: () => createContext(request)
      }));
    }

    if (url.pathname.startsWith("/rest")) {
      return withCors(request, await handleRestRequest(request));
    }

    if (url.pathname.startsWith("/webhooks")) {
      return withCors(request, await handleWebhookRequest(request));
    }

    return withCors(request, Response.json({
      service: "elate-api",
      routes: ["/trpc", "/rest/health", "/rest/phase1/status", "/webhooks/health"]
    }));
  }
});

console.log(`Elate API listening on http://localhost:${server.port}`);
