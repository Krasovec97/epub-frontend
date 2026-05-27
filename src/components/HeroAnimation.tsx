"use client";
"use no memo";

import { useEffect, useState } from "react";
import { DocToEpubFrame, FPS, TOTAL_FRAMES } from "@/remotion/DocToEpub";

export default function HeroAnimation() {
  const [frame, setFrame] = useState<number>(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      const f = Math.floor(elapsedSec * FPS) % TOTAL_FRAMES;
      setFrame(f);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <DocToEpubFrame frame={frame} />
    </div>
  );
}
