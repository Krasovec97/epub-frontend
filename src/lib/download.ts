import { NextResponse } from "next/server";

export async function streamSessionEpub(sessionId: string): Promise<Response> {
  const backendUrl = process.env.BACKEND_BASE_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const upstream = await fetch(`${backendUrl}/sessions/${sessionId}/download`, {
    cache: "no-store",
  });

  if (upstream.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Backend error" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/epub+zip",
  );
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) {
    headers.set("content-disposition", disposition);
  } else {
    headers.set(
      "content-disposition",
      `attachment; filename="pergament-${sessionId}.epub"`,
    );
  }
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
