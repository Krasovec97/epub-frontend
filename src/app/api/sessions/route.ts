import { getBackendUrl, misconfigured, relayJson } from "@/lib/backend";

// Create a draft scan session up front. Returns { sessionId, expiresAt }.
export async function POST() {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  const res = await fetch(`${backendUrl}/sessions`, {
    method: "POST",
    cache: "no-store",
  });
  return relayJson(res);
}
