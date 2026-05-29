"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { preloadOpenCv } from "@/lib/cover-detect";
import { getActiveSession } from "@/lib/scan-store";
import type { PageKind } from "@/lib/scan-api";
import CameraView from "./CameraView";
import CoverAdjust from "./CoverAdjust";
import ScanReview from "./ScanReview";
import ResumeDialog from "./ResumeDialog";
import { type ScanItem, useScanSession } from "./useScanSession";
import styles from "./ScanFlow.module.css";

type Stage = "init" | "intro" | "capturing" | "coverAdjust" | "review";

interface RetakeTarget {
  pageId: string;
  kind: PageKind;
}

export default function ScanFlow({
  initialSessionId = null,
}: {
  initialSessionId?: string | null;
}) {
  const t = useTranslations("ScanPage");
  const router = useRouter();
  const scan = useScanSession();

  const [stage, setStage] = useState<Stage>("init");
  const [showResume, setShowResume] = useState<boolean>(false);
  const [pendingCoverBlob, setPendingCoverBlob] = useState<Blob | null>(null);
  const [retakeTarget, setRetakeTarget] = useState<RetakeTarget | null>(null);
  const [finishing, setFinishing] = useState<boolean>(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const booted = useRef<boolean>(false);

  useEffect(() => {
    preloadOpenCv();
  }, []);

  // Boot: on visiting /scan, check for an existing session and decide the
  // starting stage from the adoption result (awaited, so no stale-state race).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      if (initialSessionId) {
        // Explicit /scan/{id} URL → resume directly into review.
        const r = await scan.adopt(initialSessionId);
        setStage(r.ok && r.itemCount > 0 ? "review" : "intro");
        return;
      }
      const active = getActiveSession();
      if (!active) {
        setStage("intro");
        return;
      }
      const r = await scan.adopt(active.sessionId);
      if (r.ok && r.resumable && r.itemCount > 0) {
        // A stored, still-editable session with captures → ask via the modal.
        setStage("intro");
        setShowResume(true);
      } else {
        // Expired/errored (pointer already cleared) or already paid/processing.
        if (r.ok && r.itemCount > 0) await scan.startNew();
        setStage("intro");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleResumeContinue(): void {
    setShowResume(false);
    if (scan.sessionId) void scan.adopt(scan.sessionId); // refresh from server
    setStage("review");
  }

  async function handleResumeDiscard(): Promise<void> {
    setShowResume(false);
    await scan.startNew();
    setStage("intro");
  }

  function handleCapture(blob: Blob): void {
    setFinishError(null);
    if (retakeTarget) {
      if (retakeTarget.kind === "cover") {
        setPendingCoverBlob(blob);
        setStage("coverAdjust");
        return;
      }
      void scan.retake(retakeTarget.pageId, blob);
      setRetakeTarget(null);
      setStage("review");
      return;
    }
    if (!scan.hasCover) {
      setPendingCoverBlob(blob);
      setStage("coverAdjust");
      return;
    }
    void scan.capture(blob, "page");
  }

  function handleCoverConfirm(rectified: Blob): void {
    setPendingCoverBlob(null);
    if (retakeTarget) {
      void scan.retake(retakeTarget.pageId, rectified);
      setRetakeTarget(null);
      setStage("review");
      return;
    }
    void scan.capture(rectified, "cover");
    setStage("capturing");
  }

  function handleCoverRetake(): void {
    setPendingCoverBlob(null);
    setStage("capturing");
  }

  function handleReviewRetake(item: ScanItem): void {
    if (!item.serverPageId) return;
    setRetakeTarget({ pageId: item.serverPageId, kind: item.kind });
    setStage("capturing");
  }

  // Reorder among confirmed content pages. afterPageId === null means "front".
  function uploadedPages(): ScanItem[] {
    return scan.items.filter((i) => i.kind === "page" && i.status === "uploaded");
  }

  function handleMoveUp(item: ScanItem): void {
    const pages = uploadedPages();
    const idx = pages.findIndex((p) => p.key === item.key);
    if (idx <= 0 || !item.serverPageId) return;
    const afterPageId = idx - 2 >= 0 ? pages[idx - 2].serverPageId : null;
    void scan.move(item.serverPageId, afterPageId);
  }

  function handleMoveDown(item: ScanItem): void {
    const pages = uploadedPages();
    const idx = pages.findIndex((p) => p.key === item.key);
    if (idx === -1 || idx >= pages.length - 1 || !item.serverPageId) return;
    void scan.move(item.serverPageId, pages[idx + 1].serverPageId);
  }

  async function handleFinish(): Promise<void> {
    if (scan.pageCount === 0 || finishing) return;
    if (scan.pendingCount > 0) {
      setFinishError(t("review.waitUploads"));
      return;
    }
    setFinishing(true);
    setFinishError(null);
    try {
      const res = await scan.finalize();
      router.push(`/convert/${res.sessionId}`);
    } catch {
      setFinishing(false);
      setFinishError(t("review.uploadError"));
    }
  }

  // ── Render ──

  if (stage === "init" || scan.status === "loading") {
    return <div className={styles.loading}>{t("loading")}</div>;
  }

  if (stage === "intro") {
    return (
      <>
        <section className={styles.intro}>
          <h1 className={styles.heading}>{t("intro.heading")}</h1>
          <ul className={styles.warnings}>
            <li>{t("intro.warning1")}</li>
            <li>{t("intro.warning2")}</li>
            <li>{t("intro.warning3")}</li>
            <li>{t("intro.warning4")}</li>
          </ul>
          <button
            type="button"
            className={styles.startBtn}
            onClick={() => setStage("capturing")}
          >
            {t("intro.start")}
          </button>
        </section>
        {showResume && (
          <ResumeDialog
            count={scan.items.length}
            onContinue={handleResumeContinue}
            onDiscard={handleResumeDiscard}
          />
        )}
      </>
    );
  }

  if (stage === "capturing") {
    return (
      <CameraView
        captureCount={scan.hasCover ? scan.pageCount + 1 : 0}
        onCapture={handleCapture}
        onDone={() => setStage("review")}
        onBack={() => {
          setRetakeTarget(null);
          setStage(scan.items.length > 0 ? "review" : "intro");
        }}
      />
    );
  }

  if (stage === "coverAdjust" && pendingCoverBlob) {
    return (
      <CoverAdjust
        blob={pendingCoverBlob}
        onConfirm={handleCoverConfirm}
        onRetake={handleCoverRetake}
      />
    );
  }

  return (
    <ScanReview
      items={scan.items}
      pageCount={scan.pageCount}
      finishing={finishing}
      failedCount={scan.failedCount}
      errorMessage={finishError ?? scan.errorMessage}
      onDelete={(item) => void scan.remove(item)}
      onRetake={handleReviewRetake}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onRetryFailed={scan.retryFailed}
      onAddAnother={() => setStage("capturing")}
      onFinish={handleFinish}
    />
  );
}
