import { getPhase1SystemStatus } from "../services/phase1";

export async function handleRestRequest(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/rest/health") {
    return Response.json({ status: "ok", surface: "rest" });
  }

  if (url.pathname === "/rest/phase1/status") {
    return Response.json(await getPhase1SystemStatus());
  }

  return Response.json({ error: "REST route not found" }, { status: 404 });
}
