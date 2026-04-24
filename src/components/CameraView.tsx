"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  analyzeFrame,
  analyzeMotion,
  judge,
  type QualityIssue,
  type QualityVerdict,
} from "@/lib/image-quality";
import styles from "./CameraView.module.css";

type CameraStatus =
  | "starting"
  | "ready"
  | "denied"
  | "unavailable"
  | "insecure";

type FrameState = "idle" | "good" | "bad";

export interface CaptureMeta {
  hasHeading: boolean;
}

interface CameraViewProps {
  onCapture: (blob: Blob, quality: QualityVerdict, meta: CaptureMeta) => void;
  onDone: () => void;
  onBack: () => void;
  captureCount: number;
}

type StepKind = "cover" | "page";

const CROP_ASPECT = 1 / Math.SQRT2;
const ANALYSIS_WIDTH = 128;
const ANALYSIS_HEIGHT = Math.round(ANALYSIS_WIDTH * Math.SQRT2);
const ANALYSIS_INTERVAL_MS = 250;
const FLASH_DURATION_MS = 200;

interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

function computeSourceRect(
  video: HTMLVideoElement,
  overlay: HTMLDivElement,
): SourceRect | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const videoRect = video.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  if (videoRect.width <= 0 || videoRect.height <= 0) return null;

  // `.video` uses object-fit: cover — source is scaled uniformly to cover the
  // box, with the smaller screen-to-source ratio winning (== min here).
  const scale = Math.min(
    video.videoWidth / videoRect.width,
    video.videoHeight / videoRect.height,
  );
  const renderedW = videoRect.width * scale;
  const renderedH = videoRect.height * scale;
  const offsetX = (renderedW - video.videoWidth) / 2;
  const offsetY = (renderedH - video.videoHeight) / 2;

  const left = overlayRect.left - videoRect.left;
  const top = overlayRect.top - videoRect.top;

  let sx = left * scale - offsetX;
  let sy = top * scale - offsetY;
  let sw = overlayRect.width * scale;
  let sh = overlayRect.height * scale;

  sx = Math.max(0, Math.min(sx, video.videoWidth));
  sy = Math.max(0, Math.min(sy, video.videoHeight));
  sw = Math.min(sw, video.videoWidth - sx);
  sh = Math.min(sh, video.videoHeight - sy);

  if (sw <= 0 || sh <= 0) return null;
  return { sx, sy, sw, sh };
}

export default function CameraView({
  onCapture,
  onDone,
  onBack,
  captureCount,
}: CameraViewProps) {
  const t = useTranslations("ScanPage.camera");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<ImageData | null>(null);
  const lastAnalysisTsRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const verdictRef = useRef<QualityVerdict | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [frameState, setFrameState] = useState<FrameState>("idle");
  const [primaryIssue, setPrimaryIssue] = useState<QualityIssue | null>(null);
  const [flashKey, setFlashKey] = useState<number>(0);
  const [hasHeading, setHasHeading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof window === "undefined") return;
      if (window.isSecureContext === false) {
        setStatus("insecure");
        return;
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatus("insecure");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (flashTimeoutRef.current !== null) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "ready") return;

    const canvas = document.createElement("canvas");
    canvas.width = ANALYSIS_WIDTH;
    canvas.height = ANALYSIS_HEIGHT;
    analysisCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    function tick(now: number) {
      rafIdRef.current = requestAnimationFrame(tick);
      if (now - lastAnalysisTsRef.current < ANALYSIS_INTERVAL_MS) return;
      lastAnalysisTsRef.current = now;

      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || !ctx) return;
      const rect = computeSourceRect(video, overlay);
      if (!rect) return;

      try {
        ctx.drawImage(
          video,
          rect.sx,
          rect.sy,
          rect.sw,
          rect.sh,
          0,
          0,
          ANALYSIS_WIDTH,
          ANALYSIS_HEIGHT,
        );
        const imageData = ctx.getImageData(
          0,
          0,
          ANALYSIS_WIDTH,
          ANALYSIS_HEIGHT,
        );
        const { brightness, sharpness, shadow } = analyzeFrame(imageData);
        const motion = prevFrameDataRef.current
          ? analyzeMotion(prevFrameDataRef.current, imageData)
          : null;
        prevFrameDataRef.current = imageData;

        const verdict = judge(
          { brightness, sharpness, motion, shadow },
          { lenient: true, includeMotion: true },
        );
        verdictRef.current = verdict;
        setFrameState(verdict.ok ? "good" : "bad");
        setPrimaryIssue(verdict.ok ? null : verdict.issues[0]);
      } catch {
        // getImageData / drawImage can throw on tainted canvas — skip this tick.
      }
    }

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      prevFrameDataRef.current = null;
      lastAnalysisTsRef.current = 0;
    };
  }, [status]);

  function triggerFlash() {
    setFlashKey((k) => k + 1);
    if (flashTimeoutRef.current !== null) {
      clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = setTimeout(() => {
      flashTimeoutRef.current = null;
    }, FLASH_DURATION_MS);
  }

  function handleShutter() {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;
    const rect = computeSourceRect(video, overlay);
    if (!rect) return;

    triggerFlash();

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.sw);
    canvas.height = Math.round(rect.sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    let quality: QualityVerdict;
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { brightness, sharpness, shadow } = analyzeFrame(imageData);
      quality = judge(
        { brightness, sharpness, motion: null, shadow },
        { lenient: true, includeMotion: false },
      );
    } catch {
      quality = {
        ok: true,
        issues: [],
        metrics: { brightness: 0, sharpness: 0, motion: null, shadow: 0 },
      };
    }

    const meta: CaptureMeta = { hasHeading };
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, quality, meta);
      },
      "image/jpeg",
      0.9,
    );
    setHasHeading(false);
  }

  const errorText =
    status === "denied"
      ? t("permissionDenied")
      : status === "insecure"
        ? t("insecureContext")
        : status === "unavailable"
          ? t("noCamera")
          : null;

  const stepKind: StepKind = captureCount === 0 ? "cover" : "page";
  const stepLabel =
    stepKind === "cover"
      ? t("step.cover")
      : t("step.page", { number: captureCount });
  const stepHint =
    stepKind === "cover" ? t("step.coverHint") : t("step.pageHint");

  const statusText =
    status === "ready" && frameState === "bad" && primaryIssue !== null
      ? t(`status.bad.${primaryIssue}`)
      : status === "ready" && frameState === "good"
        ? t("status.good")
        : null;

  return (
    <div className={styles.wrap}>
      {errorText && (
        <div className={styles.errorOverlay}>
          <p className={styles.errorText}>{errorText}</p>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onBack}
          >
            {t("back")}
          </button>
        </div>
      )}
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        muted
        autoPlay
      />
      <div
        className={styles.overlay}
        style={{ aspectRatio: String(CROP_ASPECT) }}
        data-state={frameState}
        ref={overlayRef}
        aria-hidden="true"
      />
      {flashKey > 0 && (
        <div
          key={flashKey}
          className={styles.flash}
          aria-hidden="true"
        />
      )}
      {status === "ready" && (
        <div className={styles.stepBanner} data-kind={stepKind}>
          <span className={styles.stepLabel}>{stepLabel}</span>
          <span className={styles.stepHint}>{stepHint}</span>
        </div>
      )}
      {statusText && (
        <div className={styles.statusHint} data-state={frameState}>
          {statusText}
        </div>
      )}
      {status === "ready" && stepKind === "page" && (
        <button
          type="button"
          className={styles.headingToggle}
          onClick={() => setHasHeading((v) => !v)}
          aria-pressed={hasHeading}
        >
          <span className={styles.headingCheck} aria-hidden="true">
            {hasHeading ? "✓" : ""}
          </span>
          <span>{t("heading.toggle")}</span>
        </button>
      )}
      <div className={styles.controls}>
        <div className={styles.counter}>
          {t("counter", { count: captureCount })}
        </div>
        <button
          type="button"
          className={styles.shutter}
          onClick={handleShutter}
          disabled={status !== "ready"}
          aria-label={t("shutter")}
        />
        <button
          type="button"
          className={styles.doneBtn}
          onClick={onDone}
          disabled={captureCount === 0}
        >
          {t("done")}
        </button>
      </div>
    </div>
  );
}
