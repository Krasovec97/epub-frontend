const OPENCV_URL = "https://docs.opencv.org/4.7.0/opencv.js";
const SCRIPT_MARKER = "data-opencv-loader";

interface CvRuntime {
  onRuntimeInitialized?: () => void;
  Mat?: unknown;
  imread?: (el: HTMLCanvasElement | HTMLImageElement) => { delete: () => void };
}

interface WindowWithCv extends Window {
  cv?: CvRuntime;
}

let openCvPromise: Promise<void> | null = null;

function getCv(): CvRuntime | null {
  if (typeof window === "undefined") return null;
  return (window as WindowWithCv).cv ?? null;
}

function runtimeReady(cv: CvRuntime | null): boolean {
  return !!cv && typeof cv.Mat !== "undefined";
}

export function ensureOpenCv(): Promise<void> {
  if (openCvPromise) return openCvPromise;
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV can only load in the browser"));
  }

  if (runtimeReady(getCv())) {
    openCvPromise = Promise.resolve();
    return openCvPromise;
  }

  openCvPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[${SCRIPT_MARKER}]`,
    );

    const waitForRuntime = () => {
      const cv = getCv();
      if (!cv) {
        reject(new Error("OpenCV did not expose a cv global"));
        return;
      }
      if (runtimeReady(cv)) {
        resolve();
        return;
      }
      cv.onRuntimeInitialized = () => resolve();
    };

    if (existing) {
      if (getCv()) waitForRuntime();
      else {
        existing.addEventListener("load", waitForRuntime, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load OpenCV.js")),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;
    script.setAttribute(SCRIPT_MARKER, "true");
    script.addEventListener("load", waitForRuntime, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load OpenCV.js")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return openCvPromise;
}

export function preloadOpenCv(): void {
  if (typeof window === "undefined") return;
  ensureOpenCv().catch(() => {
    // Preload is best-effort; callers will surface real errors via ensureOpenCv().
    openCvPromise = null;
  });
}

export interface Point {
  x: number;
  y: number;
}

export interface CornerSet {
  topLeftCorner: Point;
  topRightCorner: Point;
  bottomLeftCorner: Point;
  bottomRightCorner: Point;
}

export function defaultCorners(width: number, height: number): CornerSet {
  return {
    topLeftCorner: { x: 0, y: 0 },
    topRightCorner: { x: width, y: 0 },
    bottomRightCorner: { x: width, y: height },
    bottomLeftCorner: { x: 0, y: height },
  };
}

function cornersLookSane(
  corners: CornerSet | null | undefined,
  width: number,
  height: number,
): corners is CornerSet {
  if (!corners) return false;
  const pts = [
    corners.topLeftCorner,
    corners.topRightCorner,
    corners.bottomRightCorner,
    corners.bottomLeftCorner,
  ];
  if (
    pts.some(
      (p) => !p || typeof p.x !== "number" || typeof p.y !== "number",
    )
  ) {
    return false;
  }
  const minEdge = Math.min(width, height);
  const edges = [
    Math.hypot(
      corners.topRightCorner.x - corners.topLeftCorner.x,
      corners.topRightCorner.y - corners.topLeftCorner.y,
    ),
    Math.hypot(
      corners.bottomRightCorner.x - corners.topRightCorner.x,
      corners.bottomRightCorner.y - corners.topRightCorner.y,
    ),
    Math.hypot(
      corners.bottomLeftCorner.x - corners.bottomRightCorner.x,
      corners.bottomLeftCorner.y - corners.bottomRightCorner.y,
    ),
    Math.hypot(
      corners.topLeftCorner.x - corners.bottomLeftCorner.x,
      corners.topLeftCorner.y - corners.bottomLeftCorner.y,
    ),
  ];
  return Math.min(...edges) >= minEdge * 0.15;
}

export async function detectCorners(
  source: HTMLCanvasElement,
): Promise<CornerSet | null> {
  await ensureOpenCv();
  const cv = getCv();
  if (!cv?.imread) return null;

  const { default: Jscanify } = await import("jscanify/client");
  const scanner = new Jscanify();

  const mat = cv.imread(source);
  try {
    const contour = scanner.findPaperContour(mat) as
      | { delete?: () => void }
      | null;
    if (!contour) return null;
    const corners = scanner.getCornerPoints(contour);
    contour.delete?.();
    return cornersLookSane(corners, source.width, source.height)
      ? corners
      : null;
  } finally {
    mat.delete();
  }
}

export async function warpToCanvas(
  source: HTMLCanvasElement,
  corners: CornerSet,
  targetWidth: number,
  targetHeight: number,
): Promise<HTMLCanvasElement> {
  await ensureOpenCv();
  const { default: Jscanify } = await import("jscanify/client");
  const scanner = new Jscanify();
  const canvas = scanner.extractPaper(
    source,
    targetWidth,
    targetHeight,
    corners,
  );
  if (!canvas) {
    throw new Error("Perspective warp failed");
  }
  return canvas;
}

export async function warpToJpeg(
  source: HTMLCanvasElement,
  corners: CornerSet,
  targetWidth: number,
  targetHeight: number,
  quality: number = 0.9,
): Promise<Blob> {
  const canvas = await warpToCanvas(source, corners, targetWidth, targetHeight);
  return encodeCanvasToJpeg(canvas, quality);
}

export function rotateCanvas90Cw(
  source: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.height;
  out.height = source.width;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return out;
}

export function encodeCanvasToJpeg(
  source: HTMLCanvasElement,
  quality: number = 0.9,
  filter: string | null = null,
): Promise<Blob> {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  if (filter) ctx.filter = filter;
  ctx.drawImage(source, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/jpeg",
      quality,
    );
  });
}
