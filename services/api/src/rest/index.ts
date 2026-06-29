export async function handleRestRequest(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/rest/health") {
    return Response.json({ status: "ok", surface: "rest" });
  }

  return Response.json({ error: "REST route not found" }, { status: 404 });
}
