import { NextResponse } from "next/server";

/**
 * Shared helpers for the `/api/*` proxy routes that forward to the Python
 * backend. The browser never talks to the backend directly — every call goes
 * through a Next route handler so `BACKEND_BASE_URL` stays server-side.
 */

export function getBackendUrl(): string | null {
  return process.env.BACKEND_BASE_URL ?? null;
}

export function misconfigured(): NextResponse {
  return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
}

/** Image types accepted for a scanned page (mirrors the backend allowlist). */
export const ALLOWED_IMAGE_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Per-image ceiling. A 1:√2 JPEG of a book page is well under this. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** Forward a backend JSON response, preserving its status code. */
export async function relayJson(res: Response): Promise<NextResponse> {
  const body = await res.json().catch(() => ({ error: "Backend error" }));
  return NextResponse.json(body, { status: res.status });
}
