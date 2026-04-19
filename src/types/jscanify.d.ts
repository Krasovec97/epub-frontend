declare module "jscanify/client" {
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

  export type Scannable = HTMLImageElement | HTMLCanvasElement;

  export default class Jscanify {
    constructor();
    findPaperContour(img: unknown): unknown | null;
    getCornerPoints(contour: unknown): CornerSet;
    highlightPaper(
      image: Scannable,
      options?: { color?: string; thickness?: number },
    ): HTMLCanvasElement;
    extractPaper(
      image: Scannable,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: CornerSet,
    ): HTMLCanvasElement | null;
  }
}
