"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  defaultCorners,
  detectCorners,
  ensureOpenCv,
  warpToJpeg,
  type CornerSet,
  type Point,
} from "@/lib/cover-detect";
import styles from "./CoverAdjust.module.css";

interface CoverAdjustProps {
  blob: Blob;
  onConfirm: (rectified: Blob) => void;
  onRetake: () => void;
}

type HandleKey =
  | "topLeftCorner"
  | "topRightCorner"
  | "bottomRightCorner"
  | "bottomLeftCorner";

type Status = "loading" | "detecting" | "ready" | "warping";

const HANDLES: HandleKey[] = [
  "topLeftCorner",
  "topRightCorner",
  "bottomRightCorner",
  "bottomLeftCorner",
];

const MIN_OUTPUT_EDGE = 400;
const MAX_OUTPUT_EDGE = 2400;

function polyString(corners: CornerSet): string {
  return HANDLES.map((k) => `${corners[k].x},${corners[k].y}`).join(" ");
}

export default function CoverAdjust({
  blob,
  onConfirm,
  onRetake,
}: CoverAdjustProps) {
  const t = useTranslations("ScanPage.coverAdjust");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [corners, setCorners] = useState<CornerSet | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [hint, setHint] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<HandleKey | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setImgUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  async function handleImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    sourceCanvasRef.current = canvas;

    setCorners(defaultCorners(w, h));
    setStatus("detecting");

    try {
      await ensureOpenCv();
      const detected = await detectCorners(canvas);
      if (detected) {
        setCorners(detected);
      } else {
        setHint(t("cannotDetect"));
      }
    } catch {
      setHint(t("cannotDetect"));
    } finally {
      setStatus("ready");
    }
  }

  function clientToViewBox(
    clientX: number,
    clientY: number,
  ): Point | null {
    const svg = svgRef.current;
    const size = natural;
    if (!svg || !size) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scaleX = size.w / rect.width;
    const scaleY = size.h / rect.height;
    const x = Math.max(0, Math.min(size.w, (clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(size.h, (clientY - rect.top) * scaleY));
    return { x, y };
  }

  function handlePointerDown(
    key: HandleKey,
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = key;
  }

  function handlePointerMove(
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    const key = draggingRef.current;
    if (!key) return;
    const pt = clientToViewBox(event.clientX, event.clientY);
    if (!pt) return;
    setCorners((prev) => (prev ? { ...prev, [key]: pt } : prev));
  }

  function handlePointerUp(
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = null;
  }

  async function handleConfirm() {
    const source = sourceCanvasRef.current;
    if (!source || !corners) return;

    setStatus("warping");
    try {
      const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } =
        corners;
      const widthPx = Math.round(
        Math.max(
          Math.hypot(tr.x - tl.x, tr.y - tl.y),
          Math.hypot(br.x - bl.x, br.y - bl.y),
        ),
      );
      const heightPx = Math.round(
        Math.max(
          Math.hypot(bl.x - tl.x, bl.y - tl.y),
          Math.hypot(br.x - tr.x, br.y - tr.y),
        ),
      );
      const outW = Math.min(
        MAX_OUTPUT_EDGE,
        Math.max(MIN_OUTPUT_EDGE, widthPx),
      );
      const outH = Math.min(
        MAX_OUTPUT_EDGE,
        Math.max(MIN_OUTPUT_EDGE, heightPx),
      );

      const rectified = await warpToJpeg(source, corners, outW, outH, 0.9);
      onConfirm(rectified);
    } catch {
      setHint(t("cannotDetect"));
      setStatus("ready");
    }
  }

  const canConfirm = status === "ready" && corners !== null;

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <span className={styles.title}>{t("title")}</span>
        <span className={styles.hint}>{hint ?? t("hint")}</span>
      </header>

      <div className={styles.stage}>
        {imgUrl && (
          <div className={styles.imageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              className={styles.image}
              onLoad={handleImageLoad}
            />
            {natural && corners && (
              <svg
                ref={svgRef}
                className={styles.overlay}
                viewBox={`0 0 ${natural.w} ${natural.h}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polygon
                  className={styles.quad}
                  points={polyString(corners)}
                />
                {HANDLES.map((key) => {
                  const pt = corners[key];
                  return (
                    <circle
                      key={key}
                      className={styles.handle}
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(natural.w, natural.h) * 0.025}
                      onPointerDown={(e) => handlePointerDown(key, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    />
                  );
                })}
              </svg>
            )}
            {status === "detecting" && (
              <div className={styles.loader}>{t("detecting")}</div>
            )}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onRetake}
          disabled={status === "warping"}
        >
          {t("retake")}
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {status === "warping" ? t("detecting") : t("confirm")}
        </button>
      </div>
    </div>
  );
}
