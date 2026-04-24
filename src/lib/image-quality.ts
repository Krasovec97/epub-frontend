export type QualityIssue =
  | "dark"
  | "bright"
  | "blurry"
  | "moving"
  | "shadow";

export interface QualityMetrics {
  brightness: number;
  sharpness: number;
  motion: number | null;
  shadow: number;
}

export interface QualityVerdict {
  ok: boolean;
  issues: QualityIssue[];
  metrics: QualityMetrics;
}

export interface JudgeOptions {
  lenient: boolean;
  includeMotion: boolean;
}

const SHARPNESS_REFERENCE = 40;
const PIXEL_STRIDE = 4;
const SHADOW_GRID = 4;

export function analyzeFrame(
  data: ImageData,
): Pick<QualityMetrics, "brightness" | "sharpness" | "shadow"> {
  const { width, height, data: pixels } = data;
  let lumaSum = 0;
  let lumaSamples = 0;
  let sharpSqSum = 0;
  let sharpSamples = 0;

  const cells = SHADOW_GRID * SHADOW_GRID;
  const cellSums = new Float64Array(cells);
  const cellCounts = new Int32Array(cells);

  for (let y = 0; y < height; y += PIXEL_STRIDE) {
    const rowStart = y * width * 4;
    const cy = Math.min(
      SHADOW_GRID - 1,
      Math.floor((y / height) * SHADOW_GRID),
    );
    let prevLuma: number | null = null;
    for (let x = 0; x < width; x += PIXEL_STRIDE) {
      const idx = rowStart + x * 4;
      const luma =
        pixels[idx] * 0.299 +
        pixels[idx + 1] * 0.587 +
        pixels[idx + 2] * 0.114;
      lumaSum += luma;
      lumaSamples += 1;
      if (prevLuma !== null) {
        const diff = luma - prevLuma;
        sharpSqSum += diff * diff;
        sharpSamples += 1;
      }
      prevLuma = luma;

      const cx = Math.min(
        SHADOW_GRID - 1,
        Math.floor((x / width) * SHADOW_GRID),
      );
      const cellIdx = cy * SHADOW_GRID + cx;
      cellSums[cellIdx] += luma;
      cellCounts[cellIdx] += 1;
    }
  }

  const brightness = lumaSamples > 0 ? lumaSum / lumaSamples : 0;
  const rawSharpness =
    sharpSamples > 0 ? Math.sqrt(sharpSqSum / sharpSamples) : 0;
  const sharpness = Math.min(1, rawSharpness / SHARPNESS_REFERENCE);

  let cellMin = Infinity;
  let cellMax = -Infinity;
  for (let i = 0; i < cells; i++) {
    if (cellCounts[i] === 0) continue;
    const mean = cellSums[i] / cellCounts[i];
    if (mean < cellMin) cellMin = mean;
    if (mean > cellMax) cellMax = mean;
  }
  const shadow = cellMax > -Infinity ? cellMax - cellMin : 0;

  return { brightness, sharpness, shadow };
}

export function analyzeMotion(prev: ImageData, curr: ImageData): number {
  if (
    prev.width !== curr.width ||
    prev.height !== curr.height ||
    prev.data.length !== curr.data.length
  ) {
    return 0;
  }
  const { width, height, data: currPx } = curr;
  const prevPx = prev.data;
  let diffSum = 0;
  let samples = 0;

  for (let y = 0; y < height; y += PIXEL_STRIDE) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += PIXEL_STRIDE) {
      const idx = rowStart + x * 4;
      const lumaC =
        currPx[idx] * 0.299 +
        currPx[idx + 1] * 0.587 +
        currPx[idx + 2] * 0.114;
      const lumaP =
        prevPx[idx] * 0.299 +
        prevPx[idx + 1] * 0.587 +
        prevPx[idx + 2] * 0.114;
      diffSum += Math.abs(lumaC - lumaP);
      samples += 1;
    }
  }

  return samples > 0 ? diffSum / samples : 0;
}

export function judge(
  metrics: QualityMetrics,
  opts: JudgeOptions,
): QualityVerdict {
  const thresholds = opts.lenient
    ? {
        darkMax: 40,
        brightMin: 230,
        sharpMin: 0.18,
        motionMax: 18,
        shadowMax: 110,
      }
    : {
        darkMax: 55,
        brightMin: 215,
        sharpMin: 0.28,
        motionMax: 10,
        shadowMax: 90,
      };

  const issues: QualityIssue[] = [];
  if (metrics.brightness < thresholds.darkMax) issues.push("dark");
  else if (metrics.brightness > thresholds.brightMin) issues.push("bright");
  if (metrics.sharpness < thresholds.sharpMin) issues.push("blurry");
  if (metrics.shadow > thresholds.shadowMax) issues.push("shadow");
  if (
    opts.includeMotion &&
    metrics.motion !== null &&
    metrics.motion > thresholds.motionMax
  ) {
    issues.push("moving");
  }

  return { ok: issues.length === 0, issues, metrics };
}
