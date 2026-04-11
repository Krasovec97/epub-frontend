import { NextResponse } from "next/server";

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
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 },
    );
  }

  const file = data.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "Missing file" },
      { status: 400 },
    );
  }

  // Validate file extension
  const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some((ext) =>
    fileName.endsWith(ext),
  );
  if (!hasValidExtension) {
    return NextResponse.json(
      { error: "Only PDF and image files are accepted" },
      { status: 400 },
    );
  }

  // Proxy to backend
  const upstream = new FormData();
  upstream.append("file", file);

  const res = await fetch(`${backendUrl}/upload`, {
    method: "POST",
    body: upstream,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Backend error");
    return NextResponse.json(
      { error: text },
      { status: res.status },
    );
  }

  const result: { sessionId: string; pageCount: number } = await res.json();
  return NextResponse.json(result);
}
