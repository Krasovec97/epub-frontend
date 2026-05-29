import { getBackendUrl, misconfigured, relayJson } from "@/lib/backend";

// Lock the page count + price and move the session to 'uploaded' (the state the
// payment → /process flow expects). Optional JSON body: { quoted_price_eur }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  const body = await request.text();
  const res = await fetch(`${backendUrl}/sessions/${sessionId}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body || "{}",
  });
  return relayJson(res);
}
