"use client";
"use no memo";

import { useEffect, useRef, useState } from "react";
import { DocToEpubFrame, FPS, TOTAL_FRAMES } from "@/remotion/DocToEpub";
import styles from "./HeroPanel.module.css";

/* The animation is authored in a 420px square; the stage scales it to fit. */
const BASE = 420;

/* Frame ranges of the three scenes in DocToEpub, which are also the three
   steps: book spread → page under the lens → EPUB on the phone. */
const PHASE_STARTS = [0, 28, 56] as const;
const PHASE_ENDS = [28, 56, TOTAL_FRAMES] as const;

/* Phone visible, book and lens gone — the finished state, used when the
   visitor has asked for reduced motion. */
const STATIC_FRAME = 66;

function phaseOf(frame: number): 0 | 1 | 2 {
  if (frame < PHASE_STARTS[1]) return 0;
  if (frame < PHASE_STARTS[2]) return 1;
  return 2;
}

export interface HeroStep {
  title: string;
  desc: string;
}

interface HeroPanelProps {
  panelLabel: string;
  phaseLabels: [string, string, string];
  allPhasesLabel: string;
  animAlt: string;
  steps: [HeroStep, HeroStep, HeroStep];
}

export default function HeroPanel({
  panelLabel,
  phaseLabels,
  allPhasesLabel,
  animAlt,
  steps,
}: HeroPanelProps) {
  const [frame, setFrame] = useState<number>(0);
  const [reduced, setReduced] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const stageRef = useRef<HTMLDivElement | null>(null);

  /* Fit the fixed-size artwork to whatever width the panel ends up at. */
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;

    const fit = () => {
      const rect = stage.getBoundingClientRect();
      setScale(Math.min(rect.width, rect.height) / BASE);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  /* Drive the loop, but only while the panel is actually on screen. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setFrame(STATIC_FRAME);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    let last = -1;

    const tick = (now: number) => {
      if (start === null) start = now;
      const next = Math.floor(((now - start) / 1000) * FPS) % TOTAL_FRAMES;
      if (next !== last) {
        last = next;
        setFrame(next);
      }
      raf = requestAnimationFrame(tick);
    };

    const play = () => {
      if (raf === 0) {
        start = null;
        raf = requestAnimationFrame(tick);
      }
    };
    const pause = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const stage = stageRef.current;
    let observer: IntersectionObserver | null = null;

    if (stage !== null) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            play();
          } else {
            pause();
          }
        },
        { threshold: 0.05 },
      );
      observer.observe(stage);
    } else {
      play();
    }

    return () => {
      pause();
      if (observer !== null) observer.disconnect();
    };
  }, []);

  const phase = phaseOf(frame);
  const progress = (frame - PHASE_STARTS[phase]) / (PHASE_ENDS[phase] - PHASE_STARTS[phase]);

  return (
    <figure className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.label}>{panelLabel}</span>
        <span className={styles.phase}>
          {reduced ? allPhasesLabel : phaseLabels[phase]}
        </span>
      </div>

      <div className={styles.stage} ref={stageRef} role="img" aria-label={animAlt}>
        <div
          className={styles.anim}
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <DocToEpubFrame frame={frame} />
        </div>
      </div>

      <div className={styles.rail}>
        {steps.map((step, i) => {
          const active = reduced || i === phase;
          const fill = reduced || i < phase ? 100 : i === phase ? progress * 100 : 0;
          return (
            <div key={step.title} className={styles.item} data-active={active}>
              <p className={styles.num}>0{i + 1}</p>
              <p className={styles.title}>{step.title}</p>
              <p className={styles.desc}>{step.desc}</p>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${fill}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
