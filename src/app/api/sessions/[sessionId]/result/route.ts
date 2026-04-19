import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const backendUrl = process.env.BACKEND_BASE_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const res = await fetch(`${backendUrl}/sessions/${sessionId}/result`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Backend error" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
