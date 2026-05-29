import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
  getBackendUrl,
  misconfigured,
  relayJson,
} from "@/lib/backend";

type RouteParams = { params: Promise<{ sessionId: string; pageId: string }> };

// Stream a page image (full size, or ?thumb=1 for the ~200px thumbnail).
export async function GET(request: Request, { params }: RouteParams) {
  const { sessionId, pageId } = await params;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  const thumb = new URL(request.url).searchParams.get("thumb");
  const qs = thumb ? `?thumb=${encodeURIComponent(thumb)}` : "";
  const upstream = await fetch(
    `${backendUrl}/sessions/${sessionId}/pages/${pageId}${qs}`,
    { cache: "no-store" },
  );
  if (upstream.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Backend error" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "image/jpeg");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("cache-control", "private, max-age=60");
  return new Response(upstream.body, { status: 200, headers });
}

// Replace (retake) a page's image. Multipart: `file`.
export async function PUT(request: Request, { params }: RouteParams) {
  const { sessionId, pageId } = await params;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = data.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name);
  const res = await fetch(`${backendUrl}/sessions/${sessionId}/pages/${pageId}`, {
    method: "PUT",
    body: upstream,
  });
  return relayJson(res);
}

// Reorder a page. JSON: { afterPageId: string | null }.
export async function PATCH(request: Request, { params }: RouteParams) {
  const { sessionId, pageId } = await params;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  const body = await request.text();
  const res = await fetch(`${backendUrl}/sessions/${sessionId}/pages/${pageId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: body || "{}",
  });
  return relayJson(res);
}

// Delete a page.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { sessionId, pageId } = await params;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  const res = await fetch(`${backendUrl}/sessions/${sessionId}/pages/${pageId}`, {
    method: "DELETE",
  });
  return relayJson(res);
}
