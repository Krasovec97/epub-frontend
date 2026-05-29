/**
 * Client-side durability for the scan flow.
 *
 * Two layers:
 *  1. An IndexedDB queue of captured-but-not-yet-confirmed page blobs. Every
 *     capture is written here *before* the upload starts and removed only on a
 *     2xx. A reload drains the queue and retries, so a photo survives an
 *     interrupted upload, an offline moment, or a closed tab.
 *  2. A localStorage pointer to the active session ({ sessionId, expiresAt }),
 *     so `/scan` can offer to resume rather than silently losing progress.
 *
 * All functions guard against SSR (no window) and resolve to safe defaults.
 */

import type { PageKind } from "@/lib/scan-api";

// ── Active-session pointer (localStorage) ─────────────────────────

const ACTIVE_KEY = "pergament.activeSession";

export interface ActiveSession {
  sessionId: string;
  expiresAt: string; // ISO timestamp
}

export function setActiveSession(s: ActiveSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(s));
  } catch {
    // private mode / storage disabled — resume just won't be offered
  }
}

/** The stored session, or null if absent / malformed / past its expiry. */
export function getActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    if (!parsed?.sessionId || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearActiveSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

// ── Pending-capture queue (IndexedDB) ─────────────────────────────

const DB_NAME = "pergament-scan";
const DB_VERSION = 1;
const STORE = "pending";

export interface PendingCapture {
  localId: string;
  sessionId: string;
  blob: Blob;
  kind: PageKind;
  afterPageId: string | null;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "localId" });
        store.createIndex("bySession", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function putPending(record: PendingCapture): Promise<void> {
  const db = await openDb();
  try {
    await promisify(tx(db, "readwrite").put(record));
  } finally {
    db.close();
  }
}

export async function deletePending(localId: string): Promise<void> {
  const db = await openDb();
  try {
    await promisify(tx(db, "readwrite").delete(localId));
  } finally {
    db.close();
  }
}

/** All pending captures for a session, oldest first. */
export async function getPending(sessionId: string): Promise<PendingCapture[]> {
  const db = await openDb();
  try {
    const all = await promisify<PendingCapture[]>(
      tx(db, "readonly").index("bySession").getAll(sessionId),
    );
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

/** Drop every pending capture for a session (e.g. when starting over). */
export async function clearPending(sessionId: string): Promise<void> {
  const pending = await getPending(sessionId);
  await Promise.all(pending.map((p) => deletePending(p.localId)));
}
