"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { QualityVerdict } from "@/lib/image-quality";
import { preloadOpenCv } from "@/lib/cover-detect";
import CameraView, { type CaptureMeta } from "./CameraView";
import CoverAdjust from "./CoverAdjust";
import ScanReview, { type Capture } from "./ScanReview";
import styles from "./ScanFlow.module.css";

type Stage = "intro" | "capturing" | "coverAdjust" | "review";

interface InternalCapture extends Capture {
  blob: Blob;
}

interface PendingCover {
  blob: Blob;
  quality: QualityVerdict;
}

export default function ScanFlow() {
  const t = useTranslations("ScanPage");
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [captures, setCaptures] = useState<InternalCapture[]>([]);
  const [pendingCover, setPendingCover] = useState<PendingCover | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const capturesRef = useRef<InternalCapture[]>(captures);

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(() => {
    preloadOpenCv();
    return () => {
      capturesRef.current.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    };
  }, []);

  function appendCapture(
    blob: Blob,
    quality: QualityVerdict,
    hasHeading: boolean,
  ) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random();
    const previewUrl = URL.createObjectURL(blob);
    setCaptures((prev) => [
      ...prev,
      { id, blob, previewUrl, quality, hasHeading },
    ]);
  }

  function handleCapture(
    blob: Blob,
    quality: QualityVerdict,
    meta: CaptureMeta,
  ) {
    if (captures.length === 0) {
      setPendingCover({ blob, quality });
      setStage("coverAdjust");
      return;
    }
    appendCapture(blob, quality, meta.hasHeading);
  }

  function handleCoverConfirm(rectified: Blob) {
    if (!pendingCover) return;
    appendCapture(rectified, pendingCover.quality, false);
    setPendingCover(null);
    setStage("capturing");
  }

  function handleCoverRetake() {
    setPendingCover(null);
    setStage("capturing");
  }

  function handleDelete(id: string) {
    setCaptures((prev) => {
      const removed = prev.find((c) => c.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((c) => c.id !== id);
    });
  }

  async function handleFinish() {
    if (captures.length === 0 || uploading) return;
    setUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    captures.forEach((capture, idx) => {
      const filename =
        idx === 0
          ? "cover.jpg"
          : `page-${idx}${capture.hasHeading ? "-heading" : ""}.jpg`;
      formData.append("files", capture.blob, filename);
    });

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setErrorMessage(t("review.uploadError"));
        setUploading(false);
        return;
      }
      const data: { sessionId: string } = await res.json();
      router.push(`/convert/${data.sessionId}`);
    } catch {
      setErrorMessage(t("review.uploadError"));
      setUploading(false);
    }
  }

  if (stage === "intro") {
    return (
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
    );
  }

  if (stage === "capturing") {
    return (
      <CameraView
        captureCount={captures.length}
        onCapture={handleCapture}
        onDone={() => setStage("review")}
        onBack={() => setStage(captures.length > 0 ? "review" : "intro")}
      />
    );
  }

  if (stage === "coverAdjust" && pendingCover) {
    return (
      <CoverAdjust
        blob={pendingCover.blob}
        onConfirm={handleCoverConfirm}
        onRetake={handleCoverRetake}
      />
    );
  }

  return (
    <ScanReview
      captures={captures.map(({ id, previewUrl, quality, hasHeading }) => ({
        id,
        previewUrl,
        quality,
        hasHeading,
      }))}
      uploading={uploading}
      errorMessage={errorMessage}
      onDelete={handleDelete}
      onAddAnother={() => setStage("capturing")}
      onFinish={handleFinish}
    />
  );
}
