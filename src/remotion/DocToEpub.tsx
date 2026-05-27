import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

export const TOTAL_FRAMES = 96;
export const FPS = 30;

const COLORS = {
  paper: "#f1e9d6",
  paperShade: "#d9cdb1",
  paperEdge: "#b8a87d",
  ink: "#1a1612",
  gold: "#c8a45a",
  spine: "#6e521e",
  phoneFrame: "#1a1612",
  phoneBorder: "#2a2520",
  phoneScreen: "#f1e9d6",
};

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

function PageLines({ count = 5, seed = 0 }: { count?: number; seed?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "9%",
        height: "100%",
        padding: "14%",
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const isLast = i === count - 1;
        const w = isLast ? 50 : 85 - ((i + seed) % 3) * 9;
        return (
          <div
            key={i}
            style={{
              height: 3,
              width: `${w}%`,
              background: COLORS.ink,
              opacity: 0.62,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function FlipPage({ rotation }: { rotation: number }) {
  if (rotation === 0 || rotation <= -170) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        width: "50%",
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
        transform: `rotateY(${rotation}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.paper,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: "0 4px 4px 0",
          boxShadow: "0 0 22px rgba(0, 0, 0, 0.28)",
        }}
      >
        <PageLines count={4} seed={1} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.paperShade,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          borderRadius: "0 4px 4px 0",
        }}
      >
        <PageLines count={4} seed={2} />
      </div>
    </div>
  );
}

function BookScene({ frame }: { frame: number }) {
  // Frame 0 starts with book FULLY visible (entry happened at end of previous loop).
  // Visible:   0 – 22   (with page flips at 2-9, 8-15, 14-21)
  // Exit:     22 – 28   (1 → 0)
  // Hidden:   28 – 88
  // Re-enter: 88 – 95   (0 → 1, primes next loop)
  const exitOut = interpolate(frame, [22, 28], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const enterIn = interpolate(frame, [88, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const opacity = frame < 28 ? exitOut : frame >= 88 ? enterIn : 0;

  const lift = interpolate(frame, [88, 95], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  const flipAt = (start: number) =>
    interpolate(frame, [start, start + 7], [0, -170], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });

  const r1 = flipAt(2);
  const r2 = flipAt(8);
  const r3 = flipAt(14);

  return (
    <div
      style={{
        position: "relative",
        width: 380,
        height: 270,
        opacity,
        transform: `translateY(${frame >= 88 ? lift : 0}px)`,
        perspective: 1400,
        filter: "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.5))",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.paper,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 4,
          bottom: 4,
          width: 5,
          background: COLORS.paperEdge,
          borderRadius: "4px 0 0 4px",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 4,
          bottom: 4,
          width: 5,
          background: COLORS.paperEdge,
          borderRadius: "0 4px 4px 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 8,
          marginLeft: -4,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 50%, rgba(0,0,0,0) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "50%",
        }}
      >
        <PageLines count={5} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "50%",
        }}
      >
        <PageLines count={5} seed={4} />
      </div>
      <FlipPage rotation={r1} />
      <FlipPage rotation={r2} />
      <FlipPage rotation={r3} />
    </div>
  );
}

function Lens() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        border: `3px solid ${COLORS.gold}`,
        background: "rgba(200, 164, 90, 0.06)",
        position: "relative",
        boxShadow:
          "0 0 36px rgba(200, 164, 90, 0.42), inset 0 0 18px rgba(200, 164, 90, 0.18)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 14,
          borderRadius: "50%",
          border: `1.5px solid ${COLORS.gold}`,
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 6,
          right: 6,
          height: 1,
          marginTop: -0.5,
          background: COLORS.gold,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 6,
          bottom: 6,
          width: 1,
          marginLeft: -0.5,
          background: COLORS.gold,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 6,
          height: 6,
          marginTop: -3,
          marginLeft: -3,
          borderRadius: "50%",
          background: COLORS.gold,
        }}
      />
    </div>
  );
}

function CameraScene({ frame }: { frame: number }) {
  const enterIn = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const exitOut = interpolate(frame, [24, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  const lensX = interpolate(frame, [0, 14], [88, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const lensY = interpolate(frame, [0, 14], [-12, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const lensPulse = interpolate(frame, [14, 17, 20], [1, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scanY = interpolate(frame, [6, 18], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const scanOpacity = interpolate(frame, [6, 7, 17, 18], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flash = interpolate(frame, [18, 20, 26], [0, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: 240,
        height: 320,
        opacity: enterIn * exitOut,
        filter: "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.5))",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.paper,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <PageLines count={8} seed={2} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${scanY}%`,
            height: 2,
            background: COLORS.gold,
            opacity: scanOpacity,
            boxShadow: `0 0 24px ${COLORS.gold}, 0 0 8px ${COLORS.gold}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: COLORS.paper,
            opacity: flash,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: `${lensX}%`,
          top: `${lensY}%`,
          width: 130,
          height: 130,
          marginLeft: -65,
          marginTop: -65,
          transform: `scale(${lensPulse})`,
        }}
      >
        <Lens />
      </div>
    </div>
  );
}

function EbookContent({ variant }: { variant: number }) {
  const seed = variant * 3;
  return (
    <div
      style={{
        padding: "22px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        height: "100%",
      }}
    >
      <div
        style={{
          height: 7,
          width: "55%",
          background: COLORS.ink,
          opacity: 0.88,
          borderRadius: 1,
          marginBottom: 6,
        }}
      />
      {Array.from({ length: 13 }).map((_, i) => {
        const w = 92 - ((i + seed) % 4) * 11;
        const isLast = i === 12;
        return (
          <div
            key={i}
            style={{
              height: 3,
              width: `${isLast ? 38 : w}%`,
              background: COLORS.ink,
              opacity: 0.55,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function PhoneScene({ frame }: { frame: number }) {
  const enterIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const exitOut = interpolate(frame, [28, 34], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const lift = interpolate(frame, [0, 10], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  const fingerX = interpolate(frame, [10, 22], [115, -15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const fingerOpacity = interpolate(
    frame,
    [10, 12, 20, 22],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const pageX = interpolate(frame, [12, 22], [0, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  return (
    <div
      style={{
        position: "relative",
        width: 188,
        height: 340,
        opacity: enterIn * exitOut,
        transform: `translateY(${lift}px)`,
        filter: "drop-shadow(0 18px 36px rgba(0, 0, 0, 0.55))",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.phoneFrame,
          borderRadius: 28,
          padding: 6,
          border: `1px solid ${COLORS.phoneBorder}`,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: COLORS.phoneScreen,
            borderRadius: 22,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${pageX}%)`,
            }}
          >
            <EbookContent variant={1} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${100 + pageX}%)`,
            }}
          >
            <EbookContent variant={2} />
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: `${fingerX}%`,
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -13,
          borderRadius: "50%",
          background: "rgba(200, 164, 90, 0.55)",
          border: `2px solid ${COLORS.gold}`,
          boxShadow: "0 0 20px rgba(200, 164, 90, 0.5)",
          opacity: fingerOpacity,
        }}
      />
    </div>
  );
}

export const DocToEpubFrame: React.FC<{ frame: number }> = ({ frame }) => {
  const bookFrame = frame;
  const cameraFrame = frame - 28;
  const phoneFrame = frame - 56;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute" }}>
        <BookScene frame={bookFrame} />
      </div>
      <div style={{ position: "absolute" }}>
        <CameraScene frame={cameraFrame} />
      </div>
      <div style={{ position: "absolute" }}>
        <PhoneScene frame={phoneFrame} />
      </div>
    </AbsoluteFill>
  );
};

// Wrapper for Remotion Studio / video rendering.
export const DocToEpub: React.FC = () => {
  const frame = useCurrentFrame();
  return <DocToEpubFrame frame={frame} />;
};
