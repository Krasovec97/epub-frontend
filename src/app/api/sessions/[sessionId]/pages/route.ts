import { NextResponse } from "next/server";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
  getBackendUrl,
  misconfigured,
  relayJson,
} from "@/lib/backend";

// Upload one scanned page. Multipart: `file` (required), `kind` ('page'|'cover'),
// `after_page_id` (optional, for inserting mid-sequence).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
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
  const kind = data.get("kind");
  if (typeof kind === "string") upstream.append("kind", kind);
  const afterPageId = data.get("after_page_id");
  if (typeof afterPageId === "string" && afterPageId)
    upstream.append("after_page_id", afterPageId);

  const res = await fetch(`${backendUrl}/sessions/${sessionId}/pages`, {
    method: "POST",
    body: upstream,
  });
  return relayJson(res);
}

// List a session's pages in order (drives the resume / review grid).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const backendUrl = getBackendUrl();
  if (!backendUrl) return misconfigured();

  const res = await fetch(`${backendUrl}/sessions/${sessionId}/pages`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return relayJson(res);
}
