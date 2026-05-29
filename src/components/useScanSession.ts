"use client";

import { useEffect, useRef, useState } from "react";
import {
  type AddPageResponse,
  type FinalizeResponse,
  type PageKind,
  type ServerPage,
  ScanApiError,
  createSession,
  deletePage,
  finalizeSession,
  listPages,
  pageThumbUrl,
  replacePage,
  reorderPage,
  uploadPage,
} from "@/lib/scan-api";
import {
  type PendingCapture,
  clearActiveSession,
  clearPending,
  deletePending,
  getPending,
  putPending,
  setActiveSession,
} from "@/lib/scan-store";

export type ItemStatus = "uploaded" | "uploading" | "queued" | "failed";
export type SessionStatus = "ready" | "loading" | "expired" | "error";

/** Outcome of adopting a session — lets the caller route without racing the
 *  async state updates that adopt() performs internally. */
export interface AdoptResult {
  ok: boolean;
  resumable: boolean; // backend status is draft|uploaded (still editable)
  itemCount: number; // server pages + any pending local captures
}

/** One cell in the review grid — either a confirmed server page or a local
 *  capture still working through the upload queue. */
export interface ScanItem {
  key: string;
  kind: PageKind;
  status: ItemStatus;
  serverPageId: string | null;
  position: number | null;
  thumbUrl: string | null; // server thumbnail (proxy URL)
  previewUrl: string | null; // local object URL (pending captures)
  localId: string | null;
}

interface LocalCapture extends PendingCapture {
  previewUrl: string;
  uiStatus: Exclude<ItemStatus, "uploaded">;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

/** Cover first, then content pages by ascending position. */
function sortPages(pages: ServerPage[]): ServerPage[] {
  return [...pages].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "cover" ? -1 : 1;
    return a.position - b.position;
  });
}

// A 4xx (other than transient 408/429) means a retry can't succeed — drop it.
function isPermanent(err: unknown): boolean {
  if (!(err instanceof ScanApiError)) return false;
  return err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
}

export interface ScanSession {
  sessionId: string | null;
  status: SessionStatus;
  backendStatus: string | null; // server lifecycle: draft|uploaded|processing|…
  items: ScanItem[];
  pageCount: number; // billable content pages (excludes cover)
  hasCover: boolean;
  pendingCount: number;
  failedCount: number;
  errorMessage: string | null;
  adopt: (sessionId: string) => Promise<AdoptResult>;
  capture: (blob: Blob, kind: PageKind, afterPageId?: string | null) => Promise<void>;
  retake: (serverPageId: string, blob: Blob) => Promise<void>;
  remove: (item: ScanItem) => Promise<void>;
  move: (serverPageId: string, afterPageId: string | null) => Promise<void>;
  retryFailed: () => void;
  startNew: () => Promise<void>;
  finalize: (quotedPriceEur?: number) => Promise<FinalizeResponse>;
}

export function useScanSession(): ScanSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [serverPages, setServerPages] = useState<ServerPage[]>([]);
  const [pending, setPending] = useState<LocalCapture[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs mirror state so the async drain loop always reads the latest queue
  // without waiting for a re-render.
  const sessionIdRef = useRef<string | null>(null);
  const serverPagesRef = useRef<ServerPage[]>([]);
  const pendingRef = useRef<LocalCapture[]>([]);
  const processingRef = useRef<boolean>(false);

  function mutatePending(updater: (prev: LocalCapture[]) => LocalCapture[]): void {
    const next = updater(pendingRef.current);
    pendingRef.current = next;
    setPending(next);
  }

  function mutateServer(updater: (prev: ServerPage[]) => ServerPage[]): void {
    const next = updater(serverPagesRef.current);
    serverPagesRef.current = next;
    setServerPages(next);
  }

  function setSession(id: string | null): void {
    sessionIdRef.current = id;
    setSessionId(id);
  }

  async function ensureSession(): Promise<string> {
    if (sessionIdRef.current) return sessionIdRef.current;
    const created = await createSession();
    setSession(created.sessionId);
    setActiveSession({ sessionId: created.sessionId, expiresAt: created.expiresAt });
    return created.sessionId;
  }

  async function drain(): Promise<void> {
    if (processingRef.current) return;
    const sid = sessionIdRef.current;
    if (!sid) return;
    processingRef.current = true;
    try {
      while (true) {
        const next = pendingRef.current[0];
        // Stop at the head of the queue if it isn't ready to send — this keeps
        // uploads strictly in capture order (a failed item blocks later ones).
        if (!next || next.uiStatus !== "queued") break;

        mutatePending((prev) =>
          prev.map((c) =>
            c.localId === next.localId ? { ...c, uiStatus: "uploading" } : c,
          ),
        );
        try {
          const resp: AddPageResponse = await uploadPage(sid, next.blob, {
            kind: next.kind,
            afterPageId: next.afterPageId,
          });
          const page: ServerPage = {
            pageId: resp.pageId,
            kind: resp.kind,
            position: resp.position,
            imageUrl: `/api/sessions/${sid}/pages/${resp.pageId}`,
            thumbnailUrl: pageThumbUrl(sid, resp.pageId),
          };
          mutateServer((prev) => sortPages([...prev, page]));
          URL.revokeObjectURL(next.previewUrl);
          await deletePending(next.localId);
          mutatePending((prev) => prev.filter((c) => c.localId !== next.localId));
        } catch (err) {
          if (isPermanent(err)) {
            URL.revokeObjectURL(next.previewUrl);
            await deletePending(next.localId);
            mutatePending((prev) => prev.filter((c) => c.localId !== next.localId));
            setErrorMessage(err instanceof Error ? err.message : "Upload rejected");
          } else {
            mutatePending((prev) =>
              prev.map((c) =>
                c.localId === next.localId ? { ...c, uiStatus: "failed" } : c,
              ),
            );
          }
          break; // halt; retry on reconnect / next capture / manual retry
        }
      }
    } finally {
      processingRef.current = false;
    }
  }

  async function adopt(sid: string): Promise<AdoptResult> {
    setStatus("loading");
    setSession(sid);
    try {
      const data = await listPages(sid);
      // The backend returns its own relative URLs (/sessions/...); the browser
      // must reach images through the proxy (/api/sessions/...). Rebuild them.
      const pages = data.pages.map((p) => ({
        ...p,
        imageUrl: `/api/sessions/${sid}/pages/${p.pageId}`,
        thumbnailUrl: pageThumbUrl(sid, p.pageId),
      }));
      mutateServer(() => sortPages(pages));
      setBackendStatus(data.status);
      setActiveSession({ sessionId: sid, expiresAt: data.expiresAt });
      const stored = await getPending(sid);
      mutatePending(() =>
        stored.map((s) => ({
          ...s,
          previewUrl: URL.createObjectURL(s.blob),
          uiStatus: "queued" as const,
        })),
      );
      setStatus("ready");
      void drain();
      return {
        ok: true,
        resumable: data.status === "draft" || data.status === "uploaded",
        itemCount: data.pages.length + stored.length,
      };
    } catch (err) {
      if (err instanceof ScanApiError && err.status === 404) {
        clearActiveSession();
        setStatus("expired");
      } else {
        setStatus("error");
      }
      return { ok: false, resumable: false, itemCount: 0 };
    }
  }

  async function capture(
    blob: Blob,
    kind: PageKind,
    afterPageId: string | null = null,
  ): Promise<void> {
    setErrorMessage(null);
    try {
      const sid = await ensureSession();
      const localId = newId();
      const record: PendingCapture = {
        localId,
        sessionId: sid,
        blob,
        kind,
        afterPageId,
        createdAt: Date.now(),
      };
      await putPending(record);
      mutatePending((prev) => [
        ...prev,
        { ...record, previewUrl: URL.createObjectURL(blob), uiStatus: "queued" },
      ]);
      void drain();
    } catch (err) {
      // Session creation / IndexedDB write failed — surface it instead of
      // letting the fire-and-forget call reject unhandled.
      setErrorMessage(err instanceof Error ? err.message : "Could not start upload");
    }
  }

  async function retake(serverPageId: string, blob: Blob): Promise<void> {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const resp = await replacePage(sid, serverPageId, blob);
      // Same URL, new bytes — bust the thumbnail cache so the new image shows.
      mutateServer((prev) =>
        prev.map((p) =>
          p.pageId === serverPageId
            ? {
                ...p,
                position: resp.position,
                thumbnailUrl: `${pageThumbUrl(sid, serverPageId)}&v=${Date.now()}`,
              }
            : p,
        ),
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Retake failed");
    }
  }

  async function remove(item: ScanItem): Promise<void> {
    if (item.localId) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      await deletePending(item.localId);
      mutatePending((prev) => prev.filter((c) => c.localId !== item.localId));
      return;
    }
    const sid = sessionIdRef.current;
    if (!sid || !item.serverPageId) return;
    const pageId = item.serverPageId;
    mutateServer((prev) => prev.filter((p) => p.pageId !== pageId));
    try {
      await deletePage(sid, pageId);
    } catch {
      void adopt(sid); // resync from server on failure
    }
  }

  async function move(
    serverPageId: string,
    afterPageId: string | null,
  ): Promise<void> {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const updated = await reorderPage(sid, serverPageId, afterPageId);
      mutateServer((prev) =>
        sortPages(
          prev.map((p) =>
            p.pageId === serverPageId ? { ...p, position: updated.position } : p,
          ),
        ),
      );
    } catch {
      void adopt(sid);
    }
  }

  function retryFailed(): void {
    mutatePending((prev) =>
      prev.map((c) => (c.uiStatus === "failed" ? { ...c, uiStatus: "queued" } : c)),
    );
    void drain();
  }

  async function startNew(): Promise<void> {
    const old = sessionIdRef.current;
    if (old) await clearPending(old).catch(() => undefined);
    pendingRef.current.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    clearActiveSession();
    setSession(null);
    setBackendStatus(null);
    mutateServer(() => []);
    mutatePending(() => []);
    setErrorMessage(null);
    setStatus("ready");
  }

  async function finalize(quotedPriceEur?: number): Promise<FinalizeResponse> {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error("No active session to finalize");
    return finalizeSession(sid, quotedPriceEur);
  }

  // Retry queued/failed uploads when connectivity returns.
  useEffect(() => {
    function onOnline(): void {
      mutatePending((prev) =>
        prev.map((c) => (c.uiStatus === "failed" ? { ...c, uiStatus: "queued" } : c)),
      );
      void drain();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke any outstanding object URLs on unmount.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    };
  }, []);

  const items: ScanItem[] = [
    ...serverPages.map<ScanItem>((p) => ({
      key: p.pageId,
      kind: p.kind,
      status: "uploaded",
      serverPageId: p.pageId,
      position: p.position,
      thumbUrl: p.thumbnailUrl,
      previewUrl: null,
      localId: null,
    })),
    ...pending.map<ScanItem>((c) => ({
      key: c.localId,
      kind: c.kind,
      status: c.uiStatus,
      serverPageId: null,
      position: null,
      thumbUrl: null,
      previewUrl: c.previewUrl,
      localId: c.localId,
    })),
  ];

  const pageCount =
    serverPages.filter((p) => p.kind === "page").length +
    pending.filter((c) => c.kind === "page").length;
  const hasCover =
    serverPages.some((p) => p.kind === "cover") ||
    pending.some((c) => c.kind === "cover");

  return {
    sessionId,
    status,
    backendStatus,
    items,
    pageCount,
    hasCover,
    pendingCount: pending.length,
    failedCount: pending.filter((c) => c.uiStatus === "failed").length,
    errorMessage,
    adopt,
    capture,
    retake,
    remove,
    move,
    retryFailed,
    startNew,
    finalize,
  };
}
