import { NextResponse } from "next/server";

const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_BASE_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = data.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES})` },
      { status: 400 },
    );
  }

  let totalBytes = 0;
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "Upload too large" }, { status: 413 });
  }

  const upstream = new FormData();
  for (const file of files) {
    upstream.append("files", file, file.name);
  }

  const res = await fetch(`${backendUrl}/upload`, {
    method: "POST",
    body: upstream,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Backend error");
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const result: { sessionId: string; pageCount: number } = await res.json();
  return NextResponse.json(result);
}
