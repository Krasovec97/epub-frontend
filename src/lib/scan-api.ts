/**
 * Typed client for the incremental-scan proxy routes (`/api/sessions/**`).
 * Browser-only. Each call hits a Next route handler that forwards to the
 * Python backend.
 */

export type PageKind = "cover" | "page";

export interface ServerPage {
  pageId: string;
  kind: PageKind;
  position: number;
  imageUrl: string;
  thumbnailUrl: string;
}

export interface PagesResponse {
  sessionId: string;
  status: string;
  pageCount: number;
  expiresAt: string;
  pages: ServerPage[];
}

export interface CreateSessionResponse {
  sessionId: string;
  expiresAt: string;
}

export interface AddPageResponse {
  pageId: string;
  kind: PageKind;
  position: number;
  pageCount: number;
}

export interface FinalizeResponse {
  sessionId: string;
  pageCount: number;
  priceEur: number;
}

export class ScanApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ScanApiError";
    this.status = status;
  }
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error ?? body?.detail ?? detail;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ScanApiError(res.status, String(detail));
  }
  return res.json() as Promise<T>;
}

function fileFromBlob(blob: Blob): File {
  const type = blob.type || "image/jpeg";
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `scan.${ext}`, { type });
}

export async function createSession(): Promise<CreateSessionResponse> {
  return asJson(await fetch("/api/sessions", { method: "POST" }));
}

export async function listPages(sessionId: string): Promise<PagesResponse> {
  return asJson(
    await fetch(`/api/sessions/${sessionId}/pages`, { cache: "no-store" }),
  );
}

export async function uploadPage(
  sessionId: string,
  blob: Blob,
  opts: { kind?: PageKind; afterPageId?: string | null } = {},
): Promise<AddPageResponse> {
  const form = new FormData();
  form.append("file", fileFromBlob(blob));
  if (opts.kind) form.append("kind", opts.kind);
  if (opts.afterPageId) form.append("after_page_id", opts.afterPageId);
  return asJson(
    await fetch(`/api/sessions/${sessionId}/pages`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function replacePage(
  sessionId: string,
  pageId: string,
  blob: Blob,
): Promise<AddPageResponse> {
  const form = new FormData();
  form.append("file", fileFromBlob(blob));
  return asJson(
    await fetch(`/api/sessions/${sessionId}/pages/${pageId}`, {
      method: "PUT",
      body: form,
    }),
  );
}

export async function reorderPage(
  sessionId: string,
  pageId: string,
  afterPageId: string | null,
): Promise<ServerPage> {
  return asJson(
    await fetch(`/api/sessions/${sessionId}/pages/${pageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ afterPageId }),
    }),
  );
}

export async function deletePage(
  sessionId: string,
  pageId: string,
): Promise<{ deleted: string; pageCount: number }> {
  return asJson(
    await fetch(`/api/sessions/${sessionId}/pages/${pageId}`, {
      method: "DELETE",
    }),
  );
}

export async function finalizeSession(
  sessionId: string,
  quotedPriceEur?: number,
): Promise<FinalizeResponse> {
  return asJson(
    await fetch(`/api/sessions/${sessionId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        quotedPriceEur != null ? { quoted_price_eur: quotedPriceEur } : {},
      ),
    }),
  );
}

export function pageThumbUrl(sessionId: string, pageId: string): string {
  return `/api/sessions/${sessionId}/pages/${pageId}?thumb=1`;
}
