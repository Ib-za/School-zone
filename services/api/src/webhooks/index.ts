export async function handleWebhookRequest(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/webhooks/health") {
    return Response.json({ status: "ok", surface: "webhooks" });
  }

  return Response.json({ error: "Webhook route not found" }, { status: 404 });
}
