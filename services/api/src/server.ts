import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./context";
import { handleRestRequest } from "./rest";
import { appRouter } from "./router";
import { handleWebhookRequest } from "./webhooks";

const port = Number(process.env.PORT ?? 4000);

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/trpc")) {
      return fetchRequestHandler({
        endpoint: "/trpc",
        req: request,
        router: appRouter,
        createContext: () => createContext(request)
      });
    }

    if (url.pathname.startsWith("/rest")) {
      return handleRestRequest(request);
    }

    if (url.pathname.startsWith("/webhooks")) {
      return handleWebhookRequest(request);
    }

    return Response.json({
      service: "elate-api",
      routes: ["/trpc", "/rest/health", "/webhooks/health"]
    });
  }
});

console.log(`Elate API listening on http://localhost:${server.port}`);
