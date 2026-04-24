"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  defaultCorners,
  detectCorners,
  encodeCanvasToJpeg,
  ensureOpenCv,
  rotateCanvas90Cw,
  warpToCanvas,
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

type SubStage = "crop" | "enhance";
type CropStatus = "loading" | "detecting" | "ready" | "warping";

interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}

const HANDLES: HandleKey[] = [
  "topLeftCorner",
  "topRightCorner",
  "bottomRightCorner",
  "bottomLeftCorner",
];

const MIN_OUTPUT_EDGE = 400;
const MAX_OUTPUT_EDGE = 2400;

const MAGNIFIER_PX = 132;
const MAGNIFIER_SAMPLE_RADIUS_PX = 60;

const NEUTRAL_COLOR: ColorAdjust = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
};

const AUTO_COLOR: ColorAdjust = {
  brightness: 1.05,
  contrast: 1.15,
  saturation: 1.05,
  warmth: 0,
};

const SLIDER_RANGES = {
  brightness: { min: 0.6, max: 1.4, step: 0.01 },
  contrast: { min: 0.7, max: 1.4, step: 0.01 },
  saturation: { min: 0, max: 1.8, step: 0.01 },
  warmth: { min: -25, max: 25, step: 1 },
} as const;

function polyString(corners: CornerSet): string {
  return HANDLES.map((k) => `${corners[k].x},${corners[k].y}`).join(" ");
}

function buildFilterString(c: ColorAdjust): string {
  return `brightness(${c.brightness}) contrast(${c.contrast}) saturate(${c.saturation}) hue-rotate(${c.warmth}deg)`;
}

function formatSliderValue(key: keyof ColorAdjust, value: number): string {
  if (key === "warmth") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${Math.round(value)}°`;
  }
  const pct = Math.round((value - 1) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}`;
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
  const [cropStatus, setCropStatus] = useState<CropStatus>("loading");
  const [hint, setHint] = useState<string | null>(null);
  const [subStage, setSubStage] = useState<SubStage>("crop");
  const [warpedUrl, setWarpedUrl] = useState<string | null>(null);
  const [color, setColor] = useState<ColorAdjust>(NEUTRAL_COLOR);
  const [comparing, setComparing] = useState<boolean>(false);
  const [encoding, setEncoding] = useState<boolean>(false);
  const [draggingKey, setDraggingKey] = useState<HandleKey | null>(null);
  const [magnifier, setMagnifier] = useState<{
    cx: number;
    cy: number;
    placement: "tl" | "tr";
  } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const warpedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<HandleKey | null>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setImgUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  useEffect(() => {
    return () => {
      if (warpedUrl) URL.revokeObjectURL(warpedUrl);
    };
  }, [warpedUrl]);

  async function runDetection(canvas: HTMLCanvasElement) {
    setCropStatus("detecting");
    setHint(null);
    try {
      await ensureOpenCv();
      const detected = await detectCorners(canvas);
      if (detected) {
        setCorners(detected);
      } else {
        setCorners(defaultCorners(canvas.width, canvas.height));
        setHint(t("cannotDetect"));
      }
    } catch {
      setCorners(defaultCorners(canvas.width, canvas.height));
      setHint(t("cannotDetect"));
    } finally {
      setCropStatus("ready");
    }
  }

  async function handleImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    sourceCanvasRef.current = canvas;
    setNatural({ w, h });
    setCorners(defaultCorners(w, h));
    await runDetection(canvas);
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

  function updateMagnifier(key: HandleKey, pt: Point) {
    const placement: "tl" | "tr" =
      key === "topRightCorner" || key === "bottomRightCorner" ? "tl" : "tr";
    setMagnifier({ cx: pt.x, cy: pt.y, placement });
    drawMagnifier(pt);
  }

  function drawMagnifier(pt: Point) {
    const source = sourceCanvasRef.current;
    const target = magnifierCanvasRef.current;
    if (!source || !target) return;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const size = MAGNIFIER_PX;
    const sample = MAGNIFIER_SAMPLE_RADIUS_PX * 2;
    target.width = size;
    target.height = size;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    const sx = pt.x - MAGNIFIER_SAMPLE_RADIUS_PX;
    const sy = pt.y - MAGNIFIER_SAMPLE_RADIUS_PX;
    ctx.drawImage(source, sx, sy, sample, sample, 0, 0, size, size);
    ctx.strokeStyle = "rgba(231, 190, 96, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function handlePointerDown(
    key: HandleKey,
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = key;
    setDraggingKey(key);
    const pt = clientToViewBox(event.clientX, event.clientY);
    if (pt) updateMagnifier(key, pt);
  }

  function handlePointerMove(event: React.PointerEvent<SVGCircleElement>) {
    const key = draggingRef.current;
    if (!key) return;
    const pt = clientToViewBox(event.clientX, event.clientY);
    if (!pt) return;
    setCorners((prev) => (prev ? { ...prev, [key]: pt } : prev));
    updateMagnifier(key, pt);
  }

  function handlePointerUp(event: React.PointerEvent<SVGCircleElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = null;
    setDraggingKey(null);
    setMagnifier(null);
  }

  async function handleRedetect() {
    const source = sourceCanvasRef.current;
    if (!source) return;
    await runDetection(source);
  }

  async function handleRotate() {
    const source = sourceCanvasRef.current;
    if (!source) return;
    const rotated = rotateCanvas90Cw(source);
    sourceCanvasRef.current = rotated;
    const url = rotated.toDataURL("image/jpeg", 0.92);
    setImgUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    setNatural({ w: rotated.width, h: rotated.height });
    setCorners(defaultCorners(rotated.width, rotated.height));
    await runDetection(rotated);
  }

  async function handleNext() {
    const source = sourceCanvasRef.current;
    if (!source || !corners) return;

    setCropStatus("warping");
    try {
      const {
        topLeftCorner: tl,
        topRightCorner: tr,
        bottomLeftCorner: bl,
        bottomRightCorner: br,
      } = corners;
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

      const warped = await warpToCanvas(source, corners, outW, outH);
      warpedCanvasRef.current = warped;
      const previewBlob = await encodeCanvasToJpeg(warped, 0.85);
      const url = URL.createObjectURL(previewBlob);
      setWarpedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setColor(NEUTRAL_COLOR);
      setSubStage("enhance");
      setCropStatus("ready");
    } catch {
      setHint(t("cannotDetect"));
      setCropStatus("ready");
    }
  }

  async function handleConfirm() {
    const warped = warpedCanvasRef.current;
    if (!warped || encoding) return;
    setEncoding(true);
    try {
      const blob = await encodeCanvasToJpeg(
        warped,
        0.9,
        buildFilterString(color),
      );
      onConfirm(blob);
    } catch {
      setEncoding(false);
    }
  }

  function handleBackToCrop() {
    setSubStage("crop");
  }

  function handleSliderChange(key: keyof ColorAdjust, value: number) {
    setColor((prev) => ({ ...prev, [key]: value }));
  }

  const cropDisabled = cropStatus !== "ready" || corners === null;
  const previewFilter = comparing ? "none" : buildFilterString(color);

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.titleRow}>
          <span className={styles.title}>
            {subStage === "crop" ? t("cropTitle") : t("enhanceTitle")}
          </span>
          <span className={styles.stepIndicator} aria-hidden="true">
            <span
              className={`${styles.stepDot} ${
                subStage === "crop" ? styles.stepDotActive : ""
              }`}
            />
            <span
              className={`${styles.stepDot} ${
                subStage === "enhance" ? styles.stepDotActive : ""
              }`}
            />
          </span>
        </div>
        <span className={styles.hint}>
          {subStage === "crop"
            ? (hint ?? t("cropHint"))
            : t("enhanceHint")}
        </span>
      </header>

      {subStage === "crop" ? (
        <>
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
                      const visualR = Math.max(natural.w, natural.h) * 0.022;
                      const hitR = Math.max(natural.w, natural.h) * 0.06;
                      return (
                        <g key={key}>
                          <circle
                            className={styles.handleHit}
                            cx={pt.x}
                            cy={pt.y}
                            r={hitR}
                            onPointerDown={(e) => handlePointerDown(key, e)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                          />
                          <circle
                            className={styles.handle}
                            cx={pt.x}
                            cy={pt.y}
                            r={visualR}
                          />
                        </g>
                      );
                    })}
                  </svg>
                )}
                {cropStatus === "detecting" && (
                  <div className={styles.loader}>{t("detecting")}</div>
                )}
                {cropStatus === "warping" && (
                  <div className={styles.loader}>{t("warping")}</div>
                )}
                {magnifier && draggingKey && (
                  <div
                    className={`${styles.magnifier} ${
                      magnifier.placement === "tl"
                        ? styles.magnifierLeft
                        : styles.magnifierRight
                    }`}
                    aria-hidden="true"
                  >
                    <canvas
                      ref={magnifierCanvasRef}
                      className={styles.magnifierCanvas}
                      width={MAGNIFIER_PX}
                      height={MAGNIFIER_PX}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.toolRow}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={handleRedetect}
              disabled={cropStatus !== "ready"}
            >
              {t("redetect")}
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={handleRotate}
              disabled={cropStatus !== "ready"}
            >
              {t("rotate")}
            </button>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onRetake}
              disabled={cropStatus === "warping"}
            >
              {t("retake")}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleNext}
              disabled={cropDisabled}
            >
              {cropStatus === "warping" ? t("warping") : t("next")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.stage}>
            {warpedUrl && (
              <div className={styles.imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={warpedUrl}
                  alt=""
                  className={styles.image}
                  style={{ filter: previewFilter }}
                  draggable={false}
                />
              </div>
            )}
          </div>

          <div className={styles.sliders}>
            {(
              [
                "brightness",
                "contrast",
                "saturation",
                "warmth",
              ] as (keyof ColorAdjust)[]
            ).map((key) => {
              const range = SLIDER_RANGES[key];
              return (
                <label key={key} className={styles.sliderRow}>
                  <span className={styles.sliderLabel}>{t(key)}</span>
                  <input
                    type="range"
                    className={styles.slider}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={color[key]}
                    onChange={(e) =>
                      handleSliderChange(key, Number(e.target.value))
                    }
                  />
                  <span className={styles.sliderValue}>
                    {formatSliderValue(key, color[key])}
                  </span>
                </label>
              );
            })}
          </div>

          <div className={styles.toolRow}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setColor(AUTO_COLOR)}
            >
              {t("auto")}
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setColor(NEUTRAL_COLOR)}
            >
              {t("reset")}
            </button>
            <button
              type="button"
              className={`${styles.toolBtn} ${
                comparing ? styles.toolBtnActive : ""
              }`}
              onPointerDown={() => setComparing(true)}
              onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)}
              onPointerCancel={() => setComparing(false)}
            >
              {t("beforeAfter")}
            </button>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleBackToCrop}
              disabled={encoding}
            >
              {t("back")}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleConfirm}
              disabled={encoding}
            >
              {encoding ? t("warping") : t("confirm")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
